import { describe, test, expect, afterAll } from 'bun:test'
import { privateKeyToAccount } from '../../accounts/privateKeyToAccount.js'
import { foundry } from '../../chains/index.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import { createWalletClient } from '../../clients/createWalletClient.js'
import { http } from '../../clients/transports/http.js'
import { killProcess } from '../../utils/seismic/process.js'
import { runSanvil } from '../../utils/seismic/runSanvil.js'
import { contractABI } from '../../utils/seismic/abi.js'
import { AesGcmCrypto } from '../../utils/seismic/aes.js'
import { bytecode } from '../../utils/seismic/bytecode.js'
import { getDeployedAddress } from '../../utils/seismic/misc.js'
import type { Hex } from '~viem/types/misc.js'

const contractBytecodeFormatted: `0x${string}` = `0x${bytecode.object.replace(/^0x/, '')}`

// const _TEST_ADDRESS = '0x5615deb798bb3e4dfa0139dfa1b3d433cc23b72f'
const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const TEST_NUMBER = BigInt(10)

const anvilAccount = privateKeyToAccount(TEST_PRIVATE_KEY)

const anvilProcess = await runSanvil({ silent: true })
const exitProcess = async (code: 0 | 1) => {
  await killProcess(anvilProcess.process)
  process.exit(code)
}

const anvilClient = createPublicClient({
  chain: foundry,
  transport: http(anvilProcess.url),
})

const anvilWalletClient = createWalletClient({
  account: anvilAccount,
  chain: foundry,
  transport: http(anvilProcess.url),
})

const aesCipher = new AesGcmCrypto(
  '0x0000000000000000000000000000000000000000000000000000000000000000',
)

describe('Seismic Transaction', async () => {
  test('node detects and parses seismic transaction', async () => {
    const SET_NUMBER_SELECTOR = '3fb5c1cb'
    const INCREMENT_SELECTOR = 'd09de08a'
    // const GET_NUMBER_SELECTOR = 'f2c9ecd8'

    await anvilWalletClient.deployContract({
      abi: contractABI,
      bytecode: contractBytecodeFormatted,
    })

    await new Promise((resolve) => setTimeout(resolve, 2000))

    const deployedContractAddress = await getDeployedAddress(
      anvilClient,
      anvilWalletClient.account.address,
    )

    const set_input_raw: Hex =
      `0x${SET_NUMBER_SELECTOR}${TEST_NUMBER.toString(16)}` as Hex
    console.info('set_input_raw: ', set_input_raw)
    const set_input_encrypted = aesCipher.encrypt(
      set_input_raw,
      '0x000000000000000000000001',
    )

    console.info(
      'latest nonce: ',
      await anvilClient.getTransactionCount({
        address: anvilWalletClient.account.address,
      }),
    )

    await anvilWalletClient.sendSeismicTransaction({
      to: deployedContractAddress,
      seismicInput: set_input_encrypted.ciphertext,
      gas: 210000n,
      nonce: 1,
    })

    console.info('set_input_encrypted: ', set_input_encrypted)
    console.info(
      'set_input_decrypted: ',
      aesCipher.decrypt(
        Buffer.from(set_input_encrypted.ciphertext.slice(2), 'hex'),
        Buffer.from('000000000000000000000001', 'hex'),
        Buffer.from(set_input_encrypted.tag.slice(2), 'hex'),
      ),
    )

    const increment_input_raw = `0x${INCREMENT_SELECTOR}`
    console.info('increment_input_raw: ', increment_input_raw)
    const increment_input_encrypted = aesCipher.encrypt(
      increment_input_raw,
      '0x000000000000000000000002',
    )

    console.info(
      'latest nonce: ',
      await anvilClient.getTransactionCount({
        address: anvilWalletClient.account.address,
      }),
    )

    await anvilWalletClient.sendSeismicTransaction({
      to: deployedContractAddress,
      seismicInput: increment_input_encrypted.ciphertext,
      gas: 210000n,
      nonce: 2,
    })

    console.info('increment_input_encrypted: ', increment_input_encrypted)
    console.info(
      'increment_input_decrypted: ',
      aesCipher.decrypt(
        Buffer.from(increment_input_encrypted.ciphertext.slice(2), 'hex'),
        Buffer.from('000000000000000000000002', 'hex'),
        Buffer.from(increment_input_encrypted.tag.slice(2), 'hex'),
      ),
    )

    const getValue = await anvilClient.readContract({
      address: deployedContractAddress,
      abi: contractABI,
      functionName: 'getNumber',
    })

    console.info('getValue: ', getValue)

    const expectedValue = TEST_NUMBER + BigInt(1)
    expect(getValue).toBe(expectedValue)
  })
})

afterAll(async () => {
  await exitProcess(0)
})
