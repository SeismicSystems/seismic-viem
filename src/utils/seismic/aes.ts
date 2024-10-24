import { createCipheriv, createDecipheriv } from 'node:crypto'
import { type Hex, hexToRlp } from 'viem'

export class AesGcmCrypto {
  private readonly ALGORITHM = 'aes-256-gcm'
  private readonly TAG_LENGTH = 16 // Authentication tag length in bytes
  private readonly NONCE_LENGTH = 12 // 96 bits is the recommended nonce length for GCM
  private readonly U64_SIZE = 8 // Size of u64 in bytes

  constructor(private readonly key: Hex) {
    const keyBuffer = Buffer.from(key.slice(2), 'hex')
    if (keyBuffer.length !== 32) {
      throw new Error('Key must be 32 bytes (256 bits)')
    }
  }

  /**
   * Creates a nonce from a u64 number, matching Rust's implementation
   * @param num - The number to convert (will be treated as u64)
   */
  private numberToNonce(num: bigint | number): Buffer {
    let value = BigInt(num)

    // Create a buffer for the full nonce (12 bytes)
    const nonceBuffer = Buffer.alloc(this.NONCE_LENGTH, 0)

    // Write the u64 value in big-endian format to the first 8 bytes
    for (let i = this.U64_SIZE - 1; i >= 0; i--) {
      nonceBuffer[i] = Number(value & 0xffn)
      value = value >> 8n
    }

    // Last 4 bytes remain as zeros
    return nonceBuffer
  }

  /**
   * RLP encodes the input data
   * @param data - The hex data to encode
   */
  private rlpEncodeInput(data: Hex): Buffer {
    const rlpEncoded = hexToRlp(data)
    return Buffer.from(rlpEncoded.slice(2), 'hex')
  }

  /**
   * Validates and converts a hex nonce to buffer
   * @param nonce - The nonce in hex format
   */
  private validateAndConvertNonce(nonce: Hex): Buffer {
    const nonceBuffer = Buffer.from(nonce.slice(2), 'hex')
    if (nonceBuffer.length !== this.NONCE_LENGTH) {
      throw new Error('Nonce must be 12 bytes')
    }
    return nonceBuffer
  }

  /**
   * Creates a nonce from a number in a way compatible with the Rust backend
   */
  public createNonce(num: number | bigint): Hex {
    return `0x${this.numberToNonce(num).toString('hex')}` as Hex
  }

  /**
   * Encrypts data using either a number-based nonce or hex nonce
   */
  public encrypt(
    plaintext: Hex,
    nonce: number | bigint | Hex,
  ): {
    ciphertext: Hex
  } {
    // Handle the nonce based on its type
    const nonceBuffer =
      typeof nonce === 'string'
        ? this.validateAndConvertNonce(nonce as Hex)
        : this.numberToNonce(nonce)

    // RLP encode the input data
    const rlpEncodedData = this.rlpEncodeInput(plaintext)

    // Create cipher with key and nonce
    const cipher = createCipheriv(
      this.ALGORITHM,
      Buffer.from(this.key.slice(2), 'hex'),
      nonceBuffer,
    )

    // Encrypt the RLP encoded data
    const ciphertext = Buffer.concat([
      cipher.update(rlpEncodedData),
      cipher.final(),
      cipher.getAuthTag(), // Append the auth tag to match Rust's behavior
    ])

    return {
      ciphertext: `0x${ciphertext.toString('hex')}` as Hex,
    }
  }

  /**
   * Decrypts data using either a number-based nonce or hex nonce
   */
  public decrypt(ciphertext: Hex, nonce: number | bigint | Hex): Hex {
    // Handle the nonce based on its type
    const nonceBuffer =
      typeof nonce === 'string'
        ? this.validateAndConvertNonce(nonce as Hex)
        : this.numberToNonce(nonce)

    const ciphertextBuffer = Buffer.from(ciphertext.slice(2), 'hex')

    // Extract the tag from the end (last 16 bytes)
    const tag = ciphertextBuffer.slice(-this.TAG_LENGTH)
    const encryptedData = ciphertextBuffer.slice(0, -this.TAG_LENGTH)

    // Create decipher with key and nonce
    const decipher = createDecipheriv(
      this.ALGORITHM,
      Buffer.from(this.key.slice(2), 'hex'),
      nonceBuffer,
    )

    // Set the auth tag
    decipher.setAuthTag(tag)

    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ])

    // Remove RLP prefix from decrypted data
    const decoded = Buffer.from(decrypted.slice(1))

    return `0x${decoded.toString('hex')}` as Hex
  }
}
