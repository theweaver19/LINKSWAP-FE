import { createReducer } from '@reduxjs/toolkit'
import { updatePriceBase, updateWyreObject, updateTokenPrices, updateLPTokenPrices } from './actions'

const currentTimestamp = () => new Date().getTime()

export interface PriceState {
  lastUpdateVersionTimestamp?: number
  ethPriceBase: number | 0 // the ethereum price base
  linkPriceBase: number | 0 // the chainlink price base
  priceResponse: any | false // wyre response
  tokenPrices: any | false // token prices
  lpTokenPrices: any | false // token prices
  timestamp: number
}

export const initialState: PriceState = {
  ethPriceBase: 0,
  linkPriceBase: 0,
  priceResponse: false,
  tokenPrices: false,
  lpTokenPrices: false,
  timestamp: currentTimestamp()
}

export default createReducer(initialState, builder =>
  builder
    .addCase(updatePriceBase, (state, action) => {
      state.ethPriceBase = action.payload.ethPriceBase
      state.linkPriceBase = action.payload.linkPriceBase
      state.timestamp = currentTimestamp()
    })
    .addCase(updateWyreObject, (state, action) => {
      state.priceResponse = action.payload.priceResponse
      state.timestamp = currentTimestamp()
    })
    .addCase(updateTokenPrices, (state, action) => {
      state.tokenPrices = action.payload.tokenPrices
      state.timestamp = currentTimestamp()
    })
    .addCase(updateLPTokenPrices, (state, action) => {
      state.lpTokenPrices = action.payload.lpTokenPrices
      state.timestamp = currentTimestamp()
    })
)
