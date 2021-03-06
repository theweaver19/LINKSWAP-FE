import { BigNumber } from '@ethersproject/bignumber'
import { TransactionResponse } from '@ethersproject/providers'
import { TokenAmount, WETH } from '@uniswap/sdk'
import React, { useContext, useMemo, useState } from 'react'
import { RouteComponentProps } from 'react-router-dom'
import { Text } from 'rebass'
import styled, { ThemeContext } from 'styled-components'
import { ButtonLight, ButtonPrimary } from '../../components/Button'
import Card from '../../components/Card'
import { AutoColumn } from '../../components/Column'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import { SwapPoolTabs } from '../../components/NavigationTabs'
import { RowBetween } from '../../components/Row'
import { useTranslation } from 'react-i18next'
import { ACTIVE_REWARD_POOLS } from '../../constants'
import { useActiveWeb3React } from '../../hooks'
import { useCurrency, useToken } from '../../hooks/Tokens'
import { useWalletModalToggle } from '../../state/application/hooks'
import { Field } from '../../state/mint/actions'
import { StakingRewards } from './stakingAbi'
import { useDerivedMintInfo, useMintActionHandlers, useMintState } from '../../state/mint/hooks'
import { toV2LiquidityToken } from '../../state/user/hooks'
import { calculateGasMargin, getContract } from '../../utils'
import AppBody, { AppBodyDark } from '../AppBody'
import { Dots, Wrapper } from '../Pool/styleds'
import QuestionHelper from '../../components/QuestionHelper'
import { WrappedTokenInfo } from '../../state/lists/hooks'
import ReactGA from 'react-ga'
import { FullStakingCard } from '../../components/PositionCard'
import { useCurrencyBalance } from '../../state/wallet/hooks'
import { useTransactionAdder } from '../../state/transactions/hooks'
import hexStringToNumber from '../../utils/hexStringToNumber'
import { useTokenUsdPrices } from '../../hooks/useTokenUsdPrice'
import { useLPTokenUsdPrices } from '../../hooks/useLPTokenUsdPrice'

const Tabs = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  border-radius: 6px;
  justify-content: space-evenly;
  margin-inline-start: 16px;
`

const ActiveText = styled.div`
  font-weight: 500;
  font-size: 20px;
`

export default function Unstake({
  match: {
    params: { currencyIdA, currencyIdB }
  }
}: RouteComponentProps<{ currencyIdA?: string; currencyIdB?: string }>) {
  const [balance, setBalance] = useState(0)
  const [userBalance, setUserBalance] = useState(0)
  const [unstaking, setUnstaking] = useState(false)
  const { account, chainId, library } = useActiveWeb3React()
  const theme = useContext(ThemeContext)
  const currencyA = useCurrency(currencyIdA)
  const currencyB = useCurrency(currencyIdB)
  const fakeContract = '0x0000000000000000000000000000000000000000'
  const [rewardsContractAddress, setRewardsContractAddress] = useState(fakeContract)
  let liquidityToken: any
  let wrappedLiquidityToken
  let hasError
  let tokenA = useToken(currencyIdA)
  let tokenB = useToken(currencyIdB)

  if (!tokenA) {
    tokenA = chainId ? WETH[chainId] : WETH['1']
  }

  if (!tokenB) {
    tokenB = chainId ? WETH[chainId] : WETH['1']
  }

  if (tokenA && tokenB) {
    liquidityToken = toV2LiquidityToken([tokenA, tokenB])

    const liquidityTokenAddress = liquidityToken.address
    if (rewardsContractAddress === fakeContract) {
      ACTIVE_REWARD_POOLS.forEach((pool: any) => {
        if (pool.address === liquidityTokenAddress) {
          setRewardsContractAddress(pool.rewardsAddress)
        }
      })
    }

    wrappedLiquidityToken = new WrappedTokenInfo(
      {
        address: liquidityTokenAddress,
        chainId: Number(liquidityToken.chainId),
        name: String(liquidityToken.name),
        symbol: String(liquidityToken.symbol),
        decimals: Number(liquidityToken.decimals),
        logoURI: 'https://logos.linkswap.app/lslp.png'
      },
      []
    )
  }
  const toggleWalletModal = useWalletModalToggle()
  const { independentField, typedValue } = useMintState()
  const { dependentField, currencies, parsedAmounts, noLiquidity } = useDerivedMintInfo(
    wrappedLiquidityToken ?? undefined,
    undefined
  )
  const { onFieldAInput } = useMintActionHandlers(noLiquidity)
  const formattedAmounts = {
    [independentField]: typedValue,
    [dependentField]: parsedAmounts[dependentField]?.toSignificant(6) ?? ''
  }

  const maxAmount = userBalance | 0

  const atMaxAmounts: { [field in Field]?: TokenAmount } = [Field.CURRENCY_A].reduce((accumulator, field) => {
    return {
      ...accumulator,
      [field]: maxAmount === Number(parsedAmounts[field] ?? '0')
    }
  }, {})

  const addTransaction = useTransactionAdder()
  const { t } = useTranslation()

  const { [Field.CURRENCY_A]: parsedAmountA } = parsedAmounts
  const selectedCurrencyBalance = useCurrencyBalance(account ?? undefined, liquidityToken ?? undefined)
  let buttonString = parsedAmountA ? t('unstake') : t('enterAmount')

  async function onAdd(contractAddress: string) {
    if (rewardsContractAddress === fakeContract || !chainId || !library || !account) return
    const router = getContract(contractAddress, StakingRewards, library, account)

    const { [Field.CURRENCY_A]: parsedAmountA } = parsedAmounts

    if (!parsedAmountA || !currencyA) {
      return
    }

    const estimate = router.estimateGas.unstakeAndClaimRewards
    const method: (...args: any) => Promise<TransactionResponse> = router.unstakeAndClaimRewards
    const args: Array<string | string[] | number> = [parsedAmountA.raw.toString()]

    const value: BigNumber | null = null
    await estimate(...args, value ? { value } : {})
      .then(estimatedGasLimit =>
        method(...args, {
          ...(value ? { value } : {}),
          gasLimit: calculateGasMargin(estimatedGasLimit)
        }).then(response => {
          setUnstaking(true)
          setBalance(userBalance)
          addTransaction(response, {
            summary: t('unStakeLPTokenAmount', {
              currencyASymbol: currencyA?.symbol,
              currencyBSymbol: currencyB?.symbol,
              amount: parsedAmounts[Field.CURRENCY_A]?.toSignificant(3)
            })
          })
          ReactGA.event({
            category: 'Staking',
            action: 'Unstake',
            label: currencies[Field.CURRENCY_A]?.symbol
          })
        })
      )
      .catch(error => {
        setUnstaking(false)
        if (error?.code !== 4001) {
          console.error(error)
        }
      })
  }

  if ((parsedAmountA && Number(parsedAmounts[Field.CURRENCY_A]?.toExact()) > userBalance) || userBalance === 0) {
    buttonString = t('insufficientStakedCurrencyBalance', { inputCurrency: currencies[Field.CURRENCY_A]?.symbol })
    hasError = true
  } else {
    hasError = false
  }

  const passedCurrencyA = currencyIdA === 'ETH' ? WETH['1'] : currencyA
  const passedCurrencyB = currencyIdB === 'ETH' ? WETH['1'] : currencyB

  const stakingValues = {
    address: liquidityToken?.address,
    liquidityToken: wrappedLiquidityToken,
    rewardsAddress: rewardsContractAddress,
    tokens: [passedCurrencyA, passedCurrencyB],
    balance: Number(selectedCurrencyBalance?.toSignificant(6)) || 0
  }

  useMemo(() => {
    if (rewardsContractAddress === fakeContract || !chainId || !library || !account) return
    const rewardsContract = getContract(rewardsContractAddress, StakingRewards, library, account)
    const method: (...args: any) => Promise<BigNumber> = rewardsContract.balanceOf
    const args: Array<string | string[] | number> = [account]
    method(...args).then(response => {
      if (BigNumber.isBigNumber(response)) {
        setUserBalance(hexStringToNumber(response.toHexString(), liquidityToken.decimals))
      }
    })
  }, [account, rewardsContractAddress, liquidityToken, chainId, library])

  useMemo(() => {
    if (balance !== userBalance) {
      setUnstaking(false)
      onFieldAInput('')
    }
  }, [balance, userBalance, setUnstaking, onFieldAInput])

  useTokenUsdPrices()
  useLPTokenUsdPrices()
  return (
    <>
      <Card style={{ maxWidth: '420px', padding: '12px', backgroundColor: theme.appBGColor, marginBottom: '16px' }}>
        <SwapPoolTabs active={'stake'} />
      </Card>
      <AppBody>
        <Tabs>
          <RowBetween style={{ padding: '1rem 0' }}>
            <ActiveText>
              {t('unStakeLPToken', {
                currencyASymbol: currencyA?.symbol,
                currencyBSymbol: currencyB?.symbol
              })}
            </ActiveText>
            <QuestionHelper
              text={t('unStakeLPTokenDescription', {
                currencyASymbol: currencyA?.symbol,
                currencyBSymbol: currencyB?.symbol
              })}
            />
          </RowBetween>
        </Tabs>
        <Wrapper>
          <AutoColumn gap="20px">
            <CurrencyInputPanel
              hideCurrencySelect={true}
              balanceOveride={true}
              newBalance={userBalance}
              value={formattedAmounts[Field.CURRENCY_A]}
              onUserInput={onFieldAInput}
              onMax={() => {
                onFieldAInput(String(userBalance) ?? '')
              }}
              showMaxButton={!atMaxAmounts[Field.CURRENCY_A]}
              currency={currencies[Field.CURRENCY_A]}
              id="unstake-input-tokena"
              showCommonBases
            />
          </AutoColumn>
        </Wrapper>
      </AppBody>
      <AppBodyDark>
        {!account ? (
          <ButtonLight onClick={toggleWalletModal}>{t('connectWallet')}</ButtonLight>
        ) : (
          <AutoColumn gap={'md'}>
            {unstaking ? (
              <ButtonPrimary style={{ fontSize: '20px' }} disabled={true}>
                <Dots>{t('unstaking')}</Dots>
              </ButtonPrimary>
            ) : (
              <ButtonPrimary
                style={{ fontSize: '20px' }}
                onClick={() => {
                  onAdd(rewardsContractAddress)
                }}
                disabled={hasError || !parsedAmountA}
              >
                <Text fontSize={20} fontWeight={500}>
                  {buttonString}
                </Text>
              </ButtonPrimary>
            )}
          </AutoColumn>
        )}
      </AppBodyDark>
      {account && rewardsContractAddress && wrappedLiquidityToken && (
        <AutoColumn style={{ marginTop: '1rem', maxWidth: '420px', width: '100%' }}>
          <FullStakingCard values={stakingValues} my={true} show={true} />
        </AutoColumn>
      )}
    </>
  )
}
