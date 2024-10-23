import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { Hex } from '../../types/misc.js'

export class AesGcmCrypto {
  private readonly ALGORITHM = 'aes-256-gcm'
  private readonly TAG_LENGTH = 16
  private readonly NONCE_LENGTH = 12

  constructor(private readonly key: Hex) {
    const keyBuffer = Buffer.from(key.slice(2), 'hex')
    if (keyBuffer.length !== 32) {
      throw new Error('Key must be 32 bytes (256 bits)')
    }
  }

  public generateRandomNonce(): Hex {
    return `0x${randomBytes(this.NONCE_LENGTH).toString('hex')}` as Hex
  }

  public encrypt(
    plaintext: Hex,
    nonce: Hex,
  ): {
    ciphertext: Hex
    tag: Hex
  } {
    const nonceBuffer = Buffer.from(nonce.slice(2), 'hex')
    if (nonceBuffer.length !== this.NONCE_LENGTH) {
      throw new Error('Nonce must be 12 bytes')
    }

    // Ensure the hex string has even length by padding if necessary
    const hexData = plaintext.slice(2)
    const paddedHex = hexData.length % 2 === 0 ? hexData : `0${hexData}`
    const data = Buffer.from(paddedHex, 'hex')

    const cipher = createCipheriv(
      this.ALGORITHM,
      Buffer.from(this.key.slice(2), 'hex'),
      nonceBuffer,
    )

    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()])

    return {
      ciphertext: `0x${ciphertext.toString('hex')}` as Hex,
      tag: `0x${cipher.getAuthTag().toString('hex')}` as Hex,
    }
  }

  public decrypt(ciphertext: Buffer, nonce: Buffer, tag: Buffer): Hex {
    if (nonce.length !== this.NONCE_LENGTH) {
      throw new Error('Nonce must be 12 bytes')
    }

    const decipher = createDecipheriv(
      this.ALGORITHM,
      Buffer.from(this.key.slice(2), 'hex'),
      nonce,
    )
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])

    return `0x${decrypted.toString('hex')}` as Hex
  }
}
