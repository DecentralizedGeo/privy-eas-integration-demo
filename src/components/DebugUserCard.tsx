import React, { useState } from 'react'
import ExportWalletButton from './ExportWalletButton'
import CopyButton from './CopyButton'
import { usePrivy } from '@privy-io/react-auth'

export default function DebugUserCard() {
  const { ready, user } = usePrivy() as any

  // Read any linked wallet address (embedded or external) so we can display it when the user logged in with a wallet
  const linked = user?.linkedAccounts ?? user?.linked_accounts ?? []
  // Prefer the first linked wallet account (embedded or external)
  const walletAccount = linked.find((a: any) => a?.type === 'wallet')
  const address = walletAccount?.address ?? walletAccount?.walletAddress ?? null

  const [copied, setCopied] = useState<boolean>(false)

  const handleCopy = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      // show a small inline confirmation instead of blocking alert()
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.warn('copy failed', e)
    }
  }

  return (
  <div className="card" style={{ maxWidth: 800, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>Your User Object</h3>
          <p style={{ marginTop: 0 }}>Inspect your linked accounts or use this for troubleshooting.</p>
        </div>
      </div>

      <pre className="debug-pre">{JSON.stringify(user ?? { ready }, null, 2)}</pre>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, gap: 20, alignItems: 'flex-start' }}>
        <ExportWalletButton />

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Wallet Address</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, display: 'inline-block', maxWidth: 330, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {address ? address : 'No wallet'}
            </div>
          </div>
          {address && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <CopyButton value={address} label="Copy" />
            </div>
          )}
        </div>
      </div>
      
    </div>
  )
}
