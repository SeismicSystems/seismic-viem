import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { Hex } from '../../types/misc.js'

export class AesGcmCrypto {
  private readonly ALGORITHM = 'aes-256-gcm'
  private readonly TAG_LENGTH = 16 // Authentication tag length in bytes
  private readonly NONCE_LENGTH = 12 // 96 bits is the recommended nonce length for GCM

  constructor(private readonly key: Hex) {
    // Key must be 32 bytes (256 bits)
    const keyBuffer = Buffer.from(key.slice(2), 'hex')
    console.info('keyBuffer: ', keyBuffer)
    console.info('keyBuffer.length: ', keyBuffer.length)
    if (keyBuffer.length !== 32) {
      throw new Error('Key must be 32 bytes (256 bits)')
    }
  }

  /**
   * Generates a random nonce of appropriate length
   */
  public generateRandomNonce(): Hex {
    return randomBytes(this.NONCE_LENGTH).toString('hex') as Hex
  }

  /**
   * Encrypts data with a given nonce
   * @param plaintext - The data to encrypt
   * @param nonce - The nonce to use (must be 12 bytes)
   * @returns Object containing ciphertext and authentication tag as hex strings
   */
  public encrypt(
    plaintext: Hex,
    nonce: Hex,
  ): {
    ciphertext: Hex
    tag: Hex
  } {
    console.info('plaintext: ', plaintext)
    const nonceBuffer = Buffer.from(nonce.slice(2), 'hex')
    console.info('nonceBuffer: ', nonceBuffer)
    console.info('nonceBuffer.length: ', nonceBuffer.length)
    if (nonceBuffer.length !== this.NONCE_LENGTH) {
      throw new Error('Nonce must be 12 bytes')
    }
    console.info('plaintext.slice(2): ', plaintext.slice(2))
    const data = Buffer.from(plaintext.slice(2), 'hex')
    console.info('data: ', data.toString('hex'))

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

  /**
   * Decrypts data with a given nonce and authentication tag
   * @param ciphertext - The encrypted data
   * @param nonce - The nonce used for encryption (must be 12 bytes)
   * @param tag - The authentication tag from encryption
   * @returns Decrypted data as a Buffer
   */
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
