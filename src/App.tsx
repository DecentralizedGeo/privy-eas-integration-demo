import React from 'react'
import Providers from './Providers'
import LocationAttestationFormCard from './components/LocationAttestationFormCard'
import MapCard from './components/MapCard'
import Header from './components/Header'
import SendMessageCard from './components/SendMessageCard'
import DebugUserCard from './components/DebugUserCard'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect, useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { getChainNetworkDetails } from './config/eas-config'
import { resolveWalletAddress, getWindowEthereum } from './utils/wallet-address-helpers'
import { switchWalletChain } from './utils/wallet-chain-helpers'

function AppInner() {
  const { ready, authenticated, user, logout } = usePrivy() as any
  const { wallets } = useWallets()
  const [embeddedWallet, setEmbeddedWallet] = useState<any>(undefined)
  const [walletBalance, setWalletBalance] = useState<string>('')
  const [chainId, setChainId] = useState<number | undefined>(11155111)
  const [selectedFeature, setSelectedFeature] = useState<any | null>(null)

  const chainsConfig = getChainNetworkDetails()

  // Ensure embedded Privy wallet is on the selected chain (default Sepolia 11155111)
  useEffect(() => {
    if (!ready || !wallets) return

    async function ensureChainSwitch() {
      try {
        const embedded = wallets.find((w: any) => w.walletClientType === 'privy')
        // Set embedded into state even if undefined so other effects can react
        setEmbeddedWallet(embedded)
        
        // If we have an embedded wallet and a desired chain, switch to it
        if (embedded && chainId) {
          try {
            // Use our centralized chain switching utility
            await switchWalletChain(chainId, null, null, embedded)
          } catch (e) {
            console.warn('Chain switch failed (maybe chain not added):', e)
          }
        }
      } catch (err) {
        console.warn('ensureChainSwitch error:', err)
      }
    }

    ensureChainSwitch()
  }, [ready, wallets, chainId])

  // Unified balance fetching with RPC and injected provider fallbacks
  const fetchBalance = useCallback(async (cid?: number) => {
    try {
      const key = String(cid ?? chainId ?? '11155111')
      const cfg = chainsConfig[key]
      if (!cfg || !cfg.rpcUrl) return

      // Resolve wallet address using centralized helper
      const addr = await resolveWalletAddress(embeddedWallet, user)
      
      if (!addr) {
        setWalletBalance('')
        return
      }

      console.debug('fetchBalance: rpc=', cfg.rpcUrl, 'addr=', addr, 'chainKey=', key)

      // Strategy 1: Try RPC provider first (works for any chain)
      try {
        const rpcProvider = new ethers.JsonRpcProvider(cfg.rpcUrl)
        const balance = await rpcProvider.getBalance(addr)
        setWalletBalance(ethers.formatEther(balance))
        return
      } catch (rpcError) {
        console.debug('RPC balance fetch failed, trying injected provider', rpcError)
      }

      // Strategy 2: Fallback to injected provider (for active wallet chain)
      const ethereum = getWindowEthereum()
      if (ethereum) {
        try {
          const provider = new ethers.BrowserProvider(ethereum)
          const balance = await provider.getBalance(addr)
          setWalletBalance(ethers.formatEther(balance))
        } catch (e) {
          console.debug('Injected provider balance fetch failed', e)
        }
      }
    } catch (e) {
      console.debug('fetchBalance failed', e)
    }
  }, [chainId, chainsConfig, embeddedWallet, user])

  // Re-fetch balance when relevant state changes
  useEffect(() => {
    if (!ready) return
    fetchBalance(chainId)
  }, [ready, chainId, embeddedWallet, user, fetchBalance])

  // Handler passed to Header to request chain switch
  const handleSwitchChain = (cid: number) => {
    setChainId(cid)
  }

  return (
    <div>
      <Header
        chains={chainsConfig}
        onSwitchChain={handleSwitchChain}
        walletBalance={walletBalance}
        chainId={chainId}
      />

      <main style={{ padding: 10 }}>
        <p>This sample app demonstrates how to use Privy for authentication and to create embedded wallets. Users can then use these wallets to sign and submit on-chain <a href="https://spec.decentralizedgeo.org/" target="_blank">Location Attestations</a> that include geospatial data created via an interactive map.</p>

        <div className="top-three">
          <div className="card-col form-column">
            <DebugUserCard />
            <SendMessageCard />
          </div>

          <div className="card-col map-card">
            <MapCard feature={selectedFeature} onFeature={(geo) => { setSelectedFeature(geo) }} />
          </div>

          <div className="card-col form-column">
            <LocationAttestationFormCard chainId={chainId} initialFeature={selectedFeature} onClearFeature={(v: any) => setSelectedFeature(v)} />
          </div>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Providers>
      <AppInner />
    </Providers>
  )
}
