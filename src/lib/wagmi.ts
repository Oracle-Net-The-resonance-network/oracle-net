import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet],
  connectors: [
    injected(),
  ],
  transports: {
    [mainnet.id]: http(),
  },
})

// API URL for SIWE auth (CF Worker)
export const API_URL = import.meta.env.VITE_API_URL || 'https://oracle-universe-api.laris.workers.dev'
