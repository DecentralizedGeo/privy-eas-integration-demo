/**
 * Safely access window.ethereum if available
 */
export function getWindowEthereum(): any {
  if (typeof window === 'undefined') return null
  return (window as any)?.ethereum ?? null
}

/**
 * Resolve wallet address from multiple sources with fallback priority:
 * 1. Embedded Privy wallet
 * 2. Linked accounts from user object
 * 3. Injected provider (window.ethereum)
 * 
 * Returns the address or null if none found.
 */
export async function resolveWalletAddress(
  embeddedWallet: any,
  user: any
): Promise<string | null> {
  // Priority 1: Use embedded wallet address if available
  if (embeddedWallet?.address) {
    return embeddedWallet.address
  }

  // Priority 2: Check linked accounts from user object
  const linked = user?.linkedAccounts ?? user?.linked_accounts ?? []
  const walletAccount = linked.find((a: any) => a?.type === 'wallet')
  if (walletAccount?.address) {
    return walletAccount.address
  }

  // Priority 3: Try injected provider (MetaMask, etc.)
  const ethereum = getWindowEthereum()
  if (ethereum && typeof ethereum.request === 'function') {
    try {
      const accounts: string[] = await ethereum.request({ method: 'eth_accounts' })
      if (accounts && accounts.length > 0) {
        return accounts[0]
      }
    } catch (e) {
      // ignore
    }
  }

  return null
}
