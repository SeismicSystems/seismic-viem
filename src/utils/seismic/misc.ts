import { getContractAddress } from 'viem'

/**
 * Gets the deployed address of a contract
 */
export const getDeployedAddress = async (
  publicClient: any,
  address: `0x${string}`,
): Promise<`0x${string}`> => {
  const nonce = BigInt(
    await publicClient.getTransactionCount({
      address: address,
    }),
  )

  const deployedAddress = getContractAddress({
    from: address,
    nonce: nonce - BigInt(1),
  })

  return deployedAddress
}
