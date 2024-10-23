import { describe, test, expect, afterAll } from 'bun:test'
import { createWalletClient } from '~viem/clients/createWalletClient.js'
import { createPublicClient } from '~viem/clients/createPublicClient.js'
import { http } from '~viem/clients/transports/http.js'
import { privateKeyToAccount } from '~viem/accounts/privateKeyToAccount.js'
import { runSanvil } from '../../utils/seismic/runSanvil.js'
import { killProcess } from '../../utils/seismic/process.js'
import { foundry } from '~viem/chains/index.js'
import { sendSeismicTransaction } from './sendSeismicTransaction.js'

import { contractABI } from '../../utils/seismic/abi.js'
import { bytecode } from '../../utils/seismic/bytecode.js'
import { getDeployedAddress } from '../../utils/seismic/misc.js'
import { AesGcmCrypto } from '../../utils/seismic/aes.js'

const contractBytecodeFormatted: `0x${string}` = `0x${bytecode.object.replace(/^0x/, '')}`

const TEST_ADDRESS = '0x5615deb798bb3e4dfa0139dfa1b3d433cc23b72f'
const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const TEST_NUMBER = 10

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

const aesCipher = new AesGcmCrypto('0x00000000000000000000000000000000')

describe('Seismic Transaction', () => {
  test('node detects and parses seismic transaction', async () => {
    const SET_NUMBER_SELECTOR = '3fb5c1cb'
    const INCREMENT_SELECTOR = 'd09de08a'
    const GET_NUMBER_SELECTOR = 'f2c9ecd8'

    await anvilWalletClient.deployContract({
      abi: contractABI,
      bytecode: contractBytecodeFormatted,
    })

    await new Promise((resolve) => setTimeout(resolve, 2000))

    const deployedContractAddress = await getDeployedAddress(
      anvilClient,
      anvilWalletClient.account.address,
    )

    const set_input_raw = `0x${SET_NUMBER_SELECTOR}${TEST_NUMBER.toString(16)}`
    const set_input = aesCipher.encrypt(
      set_input_raw,
      '0x00000000000000000000000000000001',
    )
  })
})

afterAll(async () => {
  await exitProcess(0)
})
