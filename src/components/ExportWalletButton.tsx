import React from 'react'
import { usePrivy } from '@privy-io/react-auth'

export default function ExportWalletButton() {
  const { ready, authenticated, user, exportWallet } = usePrivy() as any

  // Support both camelCase (user.linkedAccounts) and snake_case (user.linked_accounts)
  const linkedAccounts = user?.linkedAccounts ?? user?.linked_accounts ?? []
  const hasEmbeddedWallet = !!linkedAccounts.find(
    (a: any) => a?.type === 'wallet' && a?.walletClientType === 'privy'
  )

  // Debug output to help troubleshooting in the browser console
  // (remove or lower verbosity in production)
  console.debug('Privy ready/authenticated:', { ready, authenticated, hasEmbeddedWallet })

  const handleExport = async () => {
    try {
      await exportWallet()
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Make sure you are authenticated and have an embedded wallet.')
    }
  }

  if (!ready) return <button disabled>Loading Privy...</button>

  const disabled = !ready || !authenticated || !hasEmbeddedWallet

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={handleExport}
        disabled={disabled}
        title={disabled ? (!authenticated ? 'You must be signed in.' : 'Only embedded wallets can be exported') : 'Export your embedded Privy wallet'}
      >
        Export wallet
      </button>
    </div>
  )
}
