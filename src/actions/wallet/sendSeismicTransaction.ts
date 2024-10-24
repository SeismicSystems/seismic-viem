import type { Address } from 'abitype'

import type { Account } from '../../accounts/types.js'
import {
  type ParseAccountErrorType,
  parseAccount,
} from '../../accounts/utils/parseAccount.js'
import type { SignTransactionErrorType } from '../../accounts/utils/signTransaction.js'
import type { Client } from '../../clients/createClient.js'
import type { Transport } from '../../clients/transports/createTransport.js'
import {
  AccountNotFoundError,
  type AccountNotFoundErrorType,
  AccountTypeNotSupportedError,
  type AccountTypeNotSupportedErrorType,
} from '../../errors/account.js'
import type { BaseError } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import {
  type RecoverAuthorizationAddressErrorType,
  recoverAuthorizationAddress,
} from '../../experimental/eip7702/utils/recoverAuthorizationAddress.js'
import type { GetAccountParameter } from '../../types/account.js'
import type { Chain, DeriveChain } from '../../types/chain.js'
import type { GetChainParameter } from '../../types/chain.js'
import type { GetTransactionRequestKzgParameter } from '../../types/kzg.js'
import type { Hex } from '../../types/misc.js'
import type { Hash } from '../../types/misc.js'
import type { TransactionRequest } from '../../types/transaction.js'
import type { UnionOmit } from '../../types/utils.js'
import type { RequestErrorType } from '../../utils/buildRequest.js'
import {
  type AssertCurrentChainErrorType,
  assertCurrentChain,
} from '../../utils/chain/assertCurrentChain.js'
import {
  type GetTransactionErrorReturnType,
  getTransactionError,
} from '../../utils/errors/getTransactionError.js'
import { extract } from '../../utils/formatters/extract.js'
import {
  type FormattedTransactionRequest,
  formatTransactionRequest,
} from '../../utils/formatters/transactionRequest.js'
import { getAction } from '../../utils/getAction.js'
import { LruMap } from '../../utils/lru.js'
import {
  type AssertRequestErrorType,
  type AssertRequestParameters,
  assertRequest,
} from '../../utils/transaction/assertRequest.js'
import { type GetChainIdErrorType, getChainId } from '../public/getChainId.js'
import {
  type PrepareTransactionRequestErrorType,
  defaultParameters,
  prepareTransactionRequest,
} from './prepareTransactionRequest.js'
import {
  type SendRawTransactionErrorType,
  sendRawTransaction,
} from './sendRawTransaction.js'

const supportsWalletNamespace = new LruMap<boolean>(128)

export type SendSeismicTransactionRequest<
  chain extends Chain | undefined = Chain | undefined,
  chainOverride extends Chain | undefined = Chain | undefined,
  ///
  _derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>,
> = UnionOmit<FormattedTransactionRequest<_derivedChain>, 'from'> &
  GetTransactionRequestKzgParameter & {
    seismicInput: Hex
  }

export type SendSeismicTransactionParameters<
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
  chainOverride extends Chain | undefined = Chain | undefined,
  request extends SendSeismicTransactionRequest<
    chain,
    chainOverride
  > = SendSeismicTransactionRequest<chain, chainOverride>,
> = request &
  GetAccountParameter<account, Account | Address, true, true> &
  GetChainParameter<chain, chainOverride> &
  GetTransactionRequestKzgParameter<request>

export type SendSeismicTransactionReturnType = Hash

export type SendSeismicTransactionErrorType =
  | ParseAccountErrorType
  | GetTransactionErrorReturnType<
      | AccountNotFoundErrorType
      | AccountTypeNotSupportedErrorType
      | AssertCurrentChainErrorType
      | AssertRequestErrorType
      | GetChainIdErrorType
      | PrepareTransactionRequestErrorType
      | SendRawTransactionErrorType
      | RecoverAuthorizationAddressErrorType
      | SignTransactionErrorType
      | RequestErrorType
    >
  | ErrorType

export async function sendSeismicTransaction<
  chain extends Chain | undefined,
  account extends Account | undefined,
  const request extends SendSeismicTransactionRequest<chain, chainOverride>,
  chainOverride extends Chain | undefined = undefined,
>(
  client: Client<Transport, chain, account>,
  parameters: SendSeismicTransactionParameters<
    chain,
    account,
    chainOverride,
    request
  >,
): Promise<SendSeismicTransactionReturnType> {
  const {
    account: account_ = client.account,
    chain = client.chain,
    accessList,
    authorizationList,
    blobs,
    data,
    gas,
    gasPrice,
    maxFeePerBlobGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce,
    value,
    seismicInput,
    ..._rest
  } = parameters
  console.info('parameters: ', parameters)

  if (typeof account_ === 'undefined')
    throw new AccountNotFoundError({
      docsPath: '/docs/actions/wallet/sendSeismicTransaction',
    })
  const account = account_ ? parseAccount(account_) : null

  try {
    assertRequest(parameters as AssertRequestParameters)

    if (
      !seismicInput ||
      typeof seismicInput !== 'string' ||
      !seismicInput.startsWith('0x')
    ) {
      throw new Error('seismicInput must be a non-empty hex string')
    }

    console.info('seismicInput: ', seismicInput)

    const to = await (async () => {
      if (parameters.to) return parameters.to
      return undefined
    })()

    console.info('to: ', to)

    if (
      account?.type === 'json-rpc' ||
      account === null ||
      account?.type === 'local'
    ) {
      console.info('chain: ', chain)
      let chainId: number | undefined
      if (chain !== null) {
        chainId = await getAction(client, getChainId, 'getChainId')({})
        assertCurrentChain({
          currentChainId: chainId,
          chain,
        })
      }

      console.info('chainId: ', chainId)

      const chainFormat = client.chain?.formatters?.transactionRequest?.format
      const _format = chainFormat || formatTransactionRequest

      // console.info(
      //   'request before format: ',
      //   format({
      //     ...extract(rest, { format: chainFormat }),
      //     accessList,
      //     authorizationList,
      //     blobs,
      //     chainId,
      //     data,
      //     from: account?.address,
      //     gas,
      //     gasPrice,
      //     maxFeePerBlobGas,
      //     maxFeePerGas,
      //     maxPriorityFeePerGas,
      //     nonce,
      //     to,
      //     value,
      //     seismicInput,
      //   } as TransactionRequest),
      // )

      const request = {
        from: account?.address,
        to,
        gas,
        gasPrice,
        nonce,
        seismicInput,
      } as TransactionRequest

      const method = 'eth_sendTransaction'
      console.info('request: ', request)

      try {
        return await client.request(
          {
            method,
            // @ts-ignore
            params: [request],
          },
          { retryCount: 0 },
        )
      } catch (e) {
        const error = e as BaseError
        if (
          error.name === 'InvalidInputRpcError' ||
          error.name === 'InvalidParamsRpcError' ||
          error.name === 'MethodNotFoundRpcError' ||
          error.name === 'MethodNotSupportedRpcError'
        )
          return await client
            .request(
              {
                method: 'wallet_sendTransaction',
                // @ts-ignore
                params: [request],
              },
              { retryCount: 0 },
            )
            .then((hash) => {
              supportsWalletNamespace.set(client.uid, true)
              return hash as Hash
            })
        throw error
      }
    }

    // if (account?.type === 'local') {
    //   console.info('local account: ', account)
    //   const request = await getAction(
    //     client,
    //     prepareTransactionRequest,
    //     'prepareTransactionRequest',
    //   )({
    //     account,
    //     accessList,
    //     authorizationList,
    //     blobs,
    //     chain,
    //     data,
    //     gas,
    //     gasPrice,
    //     maxFeePerBlobGas,
    //     maxFeePerGas,
    //     maxPriorityFeePerGas,
    //     nonce,
    //     nonceManager: account.nonceManager,
    //     parameters: [...defaultParameters, 'sidecars', 'seismicInput'],
    //     value,
    //     ...rest,
    //     to,
    //     seismicInput,
    //   } as any)

    //   const serializer = chain?.serializers?.transaction
    //   const serializedTransaction = (await account.signTransaction(request, {
    //     serializer,
    //   })) as Hash
    //   return await getAction(
    //     client,
    //     sendRawTransaction,
    //     'sendRawTransaction',
    //   )({
    //     serializedTransaction,
    //   })
    // }

    if (account?.type === 'smart')
      throw new AccountTypeNotSupportedError({
        metaMessages: ['Consider using the sendUserOperation Action instead.'],
        docsPath: '/docs/actions/bundler/sendUserOperation',
        type: 'smart',
      })

    throw new AccountTypeNotSupportedError({
      docsPath: '/docs/actions/wallet/sendSeismicTransaction',
      type: (account as any)?.type,
    })
  } catch (err) {
    if (err instanceof AccountTypeNotSupportedError) throw err
    throw getTransactionError(err as BaseError, {
      ...parameters,
      account,
      chain: parameters.chain || undefined,
    })
  }
}
