import React, { useEffect, useState } from 'react'
import { usePrivy, useLogin } from '@privy-io/react-auth'

type ChainsMap = Record<string, any>

export default function Header({ chains, onSwitchChain, walletBalance, chainId }: { chains: ChainsMap; onSwitchChain: (chainId: number) => void; walletBalance?: string; chainId?: number }) {
  const { ready, authenticated, user, logout } = usePrivy() as any
  const [lastLoginMethod, setLastLoginMethod] = useState<string | null>(null)
  const [lastLoginAccount, setLastLoginAccount] = useState<any>(null)

  // Use the useLogin hook to open the Privy login modal with preferred methods and capture the login result
  const { login } = useLogin({
    onComplete: (result: any) => {
      try {
        const method = result?.loginMethod ?? null
        const account = result?.loginAccount ?? null
        if (method) {
          setLastLoginMethod(method)
          sessionStorage.setItem('privy_last_login_method', method)
        }
        if (account) {
          setLastLoginAccount(account)
          sessionStorage.setItem('privy_last_login_account', JSON.stringify(account))
        }
      } catch (e) {}
    },
  })

  useEffect(() => {
    const m = sessionStorage.getItem('privy_last_login_method')
    if (m) setLastLoginMethod(m)
    const a = sessionStorage.getItem('privy_last_login_account')
    if (a) {
      try { setLastLoginAccount(JSON.parse(a)) } catch (e) {}
    }
  }, [])

  useEffect(() => {
    if (!authenticated) {
      setLastLoginMethod(null)
      setLastLoginAccount(null)
      sessionStorage.removeItem('privy_last_login_method')
      sessionStorage.removeItem('privy_last_login_account')
    }
  }, [authenticated])

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value)
    if (!isNaN(val)) onSwitchChain(val)
  }

  // Derive display name/address
  const display = user?.linked_accounts?.[0]?.address ?? user?.linkedAccounts?.[0]?.address ?? user?.id

  // Infer linked accounts for fallback display
  const linked = user?.linkedAccounts ?? user?.linked_accounts ?? []
  const emailAccount = linked.find((a: any) => a?.type === 'email')
  const walletAccount = linked.find((a: any) => a?.type === 'wallet')
  const providerName = (acct: any) => {
    if (!acct) return 'wallet'
    // Prefer walletClientType (e.g., 'privy', 'metamask') to avoid showing generic 'injected'
    return acct.walletClientType ?? acct.provider ?? acct.connectorType ?? acct?.meta?.providerName ?? 'wallet'

  }

  return (
    <header className="app-header">
      <div className="header-left">
        <img 
          src="https://avatars.githubusercontent.com/u/199006257?s=150&v=4" 
          alt="Location Protocol Logo" 
          className="header-logo"
        />
        <h2 className="header-title">Location Attestion Sample Tool</h2>
      </div>

      <div className="header-center" style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gridTemplateRows: 'auto auto', columnGap: 12, rowGap: 6, alignItems: 'center', justifyItems: 'start' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 70 }} className="chain-label">Network:</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select id="chain-select" className="chain-select" onChange={handleSelect} value={String(chainId ?? '11155111')}>
            {Object.keys(chains).map((k) => {
              const c = chains[k]
              return (
                <option key={k} value={k}>
                  {c.chain} ({k})
                </option>
              )
            })}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 70, textAlign: 'right' }} className="balance-label">Balance:</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="balance-value">{walletBalance ? `${walletBalance} ETH` : '—'}</div>
        </div>
      </div>

      <div className="header-right">
        {ready && !authenticated && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => login({ loginMethods: ['email', 'wallet'] })} className="btn-primary button-base">
              Log in
            </button>
          </div>
        )}
        {ready && authenticated && (
          <div className="signed-in">
            <div className="signed-in-line">
              {((lastLoginMethod === 'email') || (!lastLoginMethod && emailAccount)) && (
                <>
                  Connected via email: <span className="mono">{lastLoginAccount?.value ?? emailAccount?.address ?? emailAccount?.address}</span>
                </>
              )}

              {((lastLoginMethod === 'wallet') || (!lastLoginMethod && walletAccount)) && !((lastLoginMethod === 'email') || (!lastLoginMethod && emailAccount)) && (
                <>
                  Connected via wallet: <span className="mono">{lastLoginAccount?.provider ?? providerName(walletAccount)}</span>
                </>
              )}

              {!lastLoginMethod && !emailAccount && !walletAccount && (
                <>Connected: <span className="mono">{display}</span></>
              )}
            </div>
            <button className="btn-logout button-base" onClick={() => logout()}>Logout</button>
          </div>
        )}
      </div>
    </header>
  )
}
