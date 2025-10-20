import React from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiConfig, createConfig } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { arbitrum, base, celo, optimism, sepolia } from 'wagmi/chains'

/**
 * PRIVY SETUP - ACTIVELY USED
 * Required for authentication and embedded wallet creation.
 * This is the only setup currently in use by the application.
 */
const appId = (import.meta.env.VITE_PRIVY_APP_ID as string) || ''

/**
 * WAGMI & REACT-QUERY SETUP - PRESERVED FOR FUTURE USE
 * Currently NOT used. The app manages network selection independently via ethers.JsonRpcProvider.
 * This infrastructure is kept intact for potential future enhancements:
 * - Contract interactions with wagmi hooks (useReadContract, useWriteContract)
 * - Real-time chain/account change detection
 * - Gas estimation and transaction building
 *
 * - Advanced wallet state management
 *
 * To activate in the future:
 * 1. Import wagmi hooks in components
 * 2. Add support for multiple chains to the chains array
 * 3. Use useReadContract, useWriteContract, useAccount, useChainId hooks
  *
 * NOTE: App.tsx currently manages network selection independently via chainsConfig.
 * The Sepolia default below does NOT override the Header network selector.
 */

// Wagmi chains configuration - keeping Sepolia as fallback default
// To add more chains in the future: import { arbitrum, base, celo, optimism } from 'wagmi/chains'
// and add them to the chains array
const chains = [sepolia] as const

// Wagmi transports - uses public RPC endpoints
// To support multiple chains: add transport entries for each chain
const transports = {
  [sepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
  // [optimism.id]: http('https://mainnet.optimism.io'),
  // [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
  // [base.id]: http('https://mainnet.base.org'),
  // [celo.id]: http('https://forno.celo.org'),
}

// Wagmi connectors - injected provider (e.g., MetaMask, Privy embedded wallet)
const connectors = [injected()]

const wagmiConfig = createConfig({ chains, connectors, transports })
const queryClient = new QueryClient()

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <PrivyProvider
          appId={appId}
          config={{
            loginMethods: ['email', 'wallet'],
            embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
          }}
        >
          {children}
        </PrivyProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}
