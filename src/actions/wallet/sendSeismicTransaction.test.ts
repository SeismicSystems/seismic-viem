import { afterAll, describe, expect, test } from 'bun:test'
import { privateKeyToAccount } from '../../accounts/privateKeyToAccount.js'
import { foundry } from '../../chains/index.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import { createWalletClient } from '../../clients/createWalletClient.js'
import { http } from '../../clients/transports/http.js'
import type { Hex } from '../../types/misc.js'
import { parseGwei } from '../../utils/index.js'
import { contractABI } from '../../utils/seismic/abi.js'
import { AesGcmCrypto } from '../../utils/seismic/aes.js'
import { bytecode } from '../../utils/seismic/bytecode.js'
import { getDeployedAddress } from '../../utils/seismic/misc.js'
import { killProcess } from '../../utils/seismic/process.js'
import { runSanvil } from '../../utils/seismic/runSanvil.js'

/* Test Contract:
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Counter {
    uint256 public number;

    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    function increment() public {
        number++;
    }

    function getNumber() public view returns (uint256) {
        return number;
    }
}
*/

const testContractBytecodeFormatted: `0x${string}` = `0x${bytecode.object.replace(/^0x/, '')}`

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

    await anvilWalletClient.deployContract({
      abi: contractABI,
      bytecode: testContractBytecodeFormatted,
    })

    await new Promise((resolve) => setTimeout(resolve, 2000))

    const deployedContractAddress = await getDeployedAddress(
      anvilClient,
      anvilWalletClient.account.address,
    )

    const set_input_raw: Hex =
      `0x${SET_NUMBER_SELECTOR}${TEST_NUMBER.toString(16).padStart(64, '0')}` as Hex
    const set_input_encrypted = aesCipher.encrypt(set_input_raw, 1n)

    await anvilWalletClient.sendSeismicTransaction({
      to: deployedContractAddress,
      seismicInput: set_input_encrypted.ciphertext,
      gas: 210000n,
      gasPrice: parseGwei('20'),
      nonce: 1,
    })

    const increment_input_raw = `0x${INCREMENT_SELECTOR}`
    const increment_input_encrypted = aesCipher.encrypt(increment_input_raw, 2n)

    await anvilWalletClient.sendSeismicTransaction({
      to: deployedContractAddress,
      seismicInput: increment_input_encrypted.ciphertext,
      gas: 210000n,
      gasPrice: parseGwei('20'),
      nonce: 2,
    })

    const getValue = await anvilClient.readContract({
      address: deployedContractAddress,
      abi: contractABI,
      functionName: 'getNumber',
    })

    const expectedValue = TEST_NUMBER + BigInt(1)
    expect(getValue).toBe(expectedValue)
  })
})

afterAll(async () => {
  await exitProcess(0)
})
