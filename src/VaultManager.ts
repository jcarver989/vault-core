import clone from "lodash.clonedeep"
import { anEmptyVault, anEmptyEncryptedVault } from "./index"
import { Clock } from "./clock"
import { EncryptionKey } from "./types/crypto"
import { EncryptedVault, Vault } from "./types/vault"
import { VaultItem } from "./types/vaultItem"
import { VaultItemEncryptor } from "./VaultItemEncryptor"

export class VaultManager {
  encryptor: VaultItemEncryptor
  clock: Clock

  constructor(encryptor: VaultItemEncryptor, clock: Clock) {
    this.encryptor = encryptor
    this.clock = clock
  }

  create(): {
    vault: Vault
    encryptedVault: EncryptedVault
    vaultKey: EncryptionKey
  } {
    const vaultKey = this.encryptor.generateEncryptionKey()
    const vault = anEmptyVault()
    const encryptedVault = anEmptyEncryptedVault()
    return { vault, vaultKey, encryptedVault }
  }

  addOrUpdateItem<T>(
    vault: EncryptedVault,
    item: VaultItem<T>,
    vaultKey: EncryptionKey
  ): EncryptedVault {
    const updatedVault = clone(vault)
    const encryptedItem = this.encryptor.encrypt(item, vaultKey)
    const existingItemIndex = vault.items.findIndex(_ => _.id === item.id)

    if (existingItemIndex != -1) {
      updatedVault.items[existingItemIndex] = encryptedItem
    } else {
      updatedVault.items.push(encryptedItem)
    }

    const timestamp = this.clock.getTime()
    const hmac = this.encryptor.hmac(updatedVault.items, vaultKey, timestamp)
    updatedVault.lastModified = timestamp
    updatedVault.hmacOfItems = hmac
    return updatedVault
  }

  deleteItem<T>(
    vault: EncryptedVault,
    item: VaultItem<T>,
    vaultKey: EncryptionKey
  ): EncryptedVault {
    const updatedVault = clone(vault)
    updatedVault.items = vault.items.filter(_ => _.id != item.id)
    const timestamp = this.clock.getTime()
    const hmac = this.encryptor.hmac(updatedVault.items, vaultKey, timestamp)
    updatedVault.lastModified = timestamp
    updatedVault.hmacOfItems = hmac
    return updatedVault
  }

  decrypt(vault: EncryptedVault, vaultKey: EncryptionKey): Vault {
    const { hmacOfItems, lastModified } = vault

    const items = this.encryptor.decryptItemsWithHMAC(
      vault.items,
      vaultKey,
      lastModified,
      hmacOfItems
    )

    const sharedItems = vault.sharedItems.map(
      ({ itemsOwnerId, itemsOwnerName, items, hmacOfItems, lastModified }) => {
        const decryptedSharedItems = this.encryptor.decryptItemsWithHMAC(
          items,
          vaultKey,
          lastModified,
          hmacOfItems
        )

        return {
          itemsOwnerId,
          itemsOwnerName,
          items: decryptedSharedItems
        }
      }
    )

    return { items, sharedItems }
  }
}