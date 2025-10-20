import { BrowserProvider as EthersBrowserProvider } from 'ethers'

/**
 * Parse a chain ID from various formats: number, CAIP-style (eip155:10), hex (0x...), or decimal string.
 * Returns numeric chain ID or null if parsing fails.
 */
export function parseChainId(value: any): number | null {
  if (typeof value === 'number') return value
  if (!value) return null
  
  if (typeof value === 'string') {
    // CAIP-style: eip155:10
    if (value.startsWith('eip155:')) {
      const parts = value.split(':')
      const n = Number(parts[1])
      return Number.isNaN(n) ? null : n
    }
    
    // Hex: 0x...
    if (value.startsWith('0x')) {
      const n = parseInt(value.slice(2), 16)
      return Number.isNaN(n) ? null : n
    }
    
    // Decimal string
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  
  return null
}

/**
 * Resolve a provider from wagmiSigner, wagmiProvider, or a wallet object.
 * Tries multiple strategies to obtain a usable provider.
 */
export async function resolveProvider(
  wagmiSigner: any,
  wagmiProvider: any,
  wallet?: any
): Promise<any> {
  // Prefer wagmiSigner/provider if present
  const wagmiProv: any = (wagmiSigner as any)?.provider ?? (wagmiProvider as any)
  let provider: any = wagmiProv ?? null

  // If no wagmi provider, try to get from wallet
  if (!provider && wallet) {
    provider = wallet.provider ?? null
    
    // Try getEthereumProvider method if provider not directly available
    if (!provider && typeof wallet.getEthereumProvider === 'function') {
      try {
        provider = await wallet.getEthereumProvider()
      } catch (e) {
        // ignore
      }
    }
  }

  return provider
}

/**
 * Detect the current chain ID from a provider using multiple strategies.
 * Tries: getNetwork(), eth_chainId RPC, wallet metadata, and provider properties.
 */
export async function detectChainId(
  provider: any,
  wallet?: any
): Promise<number | null> {
  let chainId: number | null = null

  // Strategy 1: Try getNetwork() method (ethers.BrowserProvider)
  if (provider && typeof provider.getNetwork === 'function') {
    try {
      const net = await provider.getNetwork()
      if (net && typeof net.chainId === 'number') {
        return net.chainId
      }
    } catch (e) {
      // ignore and continue
    }
  }

  // Strategy 2: Try eth_chainId RPC
  if (provider && typeof provider.request === 'function') {
    try {
      const hex = await provider.request({ method: 'eth_chainId' })
      if (typeof hex === 'string') {
        chainId = parseChainId(hex)
        if (chainId !== null) return chainId
      }
    } catch (e) {
      // ignore
    }
  }

  // Strategy 3: Check wallet metadata (for wallets that expose chainId)
  if (wallet) {
    const maybeRaw = wallet.chainId ?? (wallet.network && wallet.network.chainId)
    chainId = parseChainId(maybeRaw)
    if (chainId !== null) return chainId
  }

  // Strategy 4: Check provider properties directly (legacy wrappers)
  if (provider && (provider.chainId || provider._chainId)) {
    const maybe = provider.chainId ?? provider._chainId
    chainId = parseChainId(maybe)
    if (chainId !== null) return chainId
  }

  return null
}

/**
 * Resolve a signer from wagmiSigner or create one from wallet provider.
 * Returns { signer, selectedWallet } where selectedWallet is the wallet matching the signer address.
 */
export async function resolveSigner(
  wallets: any[],
  wagmiSigner: any,
  wagmiProvider: any
): Promise<{ signer: any; selectedWallet: any }> {
  if (!wallets || wallets.length === 0) {
    throw new Error('No connected wallets')
  }

  let signer = wagmiSigner
  let selectedWallet: any = undefined

  // If wagmiSigner exists, try to find matching wallet by address
  if (signer) {
    try {
      const signerAddress = await signer.getAddress()
      selectedWallet = wallets.find(
        (w: any) => w.address && w.address.toLowerCase() === signerAddress.toLowerCase()
      )
    } catch (err) {
      // ignore — signer may be present but fail to return address; we still prefer it
    }
  }

  // If no wagmiSigner, create signer from wallet provider
  if (!signer) {
    selectedWallet = wallets.find((w: any) => w.provider) || wallets[0]
    if (!selectedWallet) {
      throw new Error('No connected wallet available')
    }

    // Get provider from wallet
    let rawProvider: any = selectedWallet.provider ?? null
    if (!rawProvider && typeof selectedWallet.getEthereumProvider === 'function') {
      try {
        rawProvider = await selectedWallet.getEthereumProvider()
      } catch (e) {
        // ignore
      }
    }

    if (!rawProvider) {
      throw new Error('No connected wallet provider available')
    }

    const browserProvider = new EthersBrowserProvider(rawProvider as any)
    signer = await browserProvider.getSigner(selectedWallet.address)
  }

  return { signer, selectedWallet }
}

/**
 * Attempt to switch the wallet to the specified chain using wallet_switchEthereumChain RPC.
 * Throws error with diagnostic information if switching fails.
 */
export async function switchWalletChain(
  desiredChainId: number,
  wagmiSigner: any,
  wagmiProvider: any,
  wallet?: any
): Promise<void> {
  try {
    const provider = await resolveProvider(wagmiSigner, wagmiProvider, wallet)

    if (provider && typeof provider.request === 'function') {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${desiredChainId.toString(16)}` }],
      })
    }
  } catch (switchErr: any) {
    throw Object.assign(
      new Error(`Failed to switch wallet to chain ${desiredChainId}: ${switchErr?.message ?? String(switchErr)}`),
      { __diagnostic: { cause: switchErr, requestedChainId: desiredChainId } }
    )
  }
}

/**
 * Wait for a chainChanged event from the wallet/provider with timeout.
 * Listens to both window.ethereum 'chainChanged' and provider 'network' events.
 * Returns the new chain ID or null if timeout occurs.
 */
export async function waitForChainChangeEvent(
  provider: any,
  timeoutMs: number = 8000
): Promise<number | null> {
  return new Promise<number | null>((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        resolve(null)
      }
    }, timeoutMs)

    const anyWindow: any = typeof window !== 'undefined' ? (window as any) : null

    // Handler for injected provider chainChanged (receives chainHex)
    const ethHandler = (chainHex: any) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      
      // Cleanup listener
      try {
        anyWindow?.ethereum?.removeListener && anyWindow.ethereum.removeListener('chainChanged', ethHandler)
      } catch (e) {
        // ignore
      }

      // Parse chain ID
      try {
        const chainId = parseChainId(chainHex)
        resolve(chainId)
      } catch (e) {
        resolve(null)
      }
    }

    // Handler for ethers provider 'network' event (receives newNetwork, oldNetwork)
    const networkHandler = (newNetwork: any, _oldNetwork: any) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      
      // Cleanup listener
      try {
        provider.removeListener && provider.removeListener('network', networkHandler)
      } catch (e) {
        // ignore
      }

      // Extract chain ID from network object
      try {
        if (newNetwork && typeof newNetwork.chainId === 'number') {
          resolve(newNetwork.chainId)
        } else {
          resolve(null)
        }
      } catch (e) {
        resolve(null)
      }
    }

    // Try to attach to injected provider first (window.ethereum)
    try {
      if (anyWindow && anyWindow.ethereum && typeof anyWindow.ethereum.on === 'function') {
        try {
          anyWindow.ethereum.on('chainChanged', ethHandler)
          return
        } catch (e) {
          // fall through to provider listener
        }
      }
    } catch (e) {
      // ignore
    }

    // Otherwise try ethers provider 'network' event
    try {
      if (provider && typeof provider.on === 'function') {
        provider.on('network', networkHandler)
        return
      }
    } catch (e) {
      // ignore
    }

    // If neither is attachable, resolve null immediately
    clearTimeout(timer)
    resolve(null)
  })
}

/**
 * Verify that the wallet is on the desired chain. If not, wait for chain change event and re-check.
 * Throws error with diagnostics if wallet is on wrong chain after all attempts.
 * Returns the verified signer (may re-create if needed).
 */
export async function verifyWalletChain(
  desiredChainId: number,
  wagmiSigner: any,
  wagmiProvider: any,
  wallet?: any,
  currentSigner?: any
): Promise<any> {
  // Resolve a provider to query the current chain id
  const probeProvider = await resolveProvider(wagmiSigner, wagmiProvider, wallet)

  // Detect actual chain ID using all available strategies
  let actualChainId = await detectChainId(probeProvider, wallet)

  // If we still can't determine chain, try one more time with wagmiSigner's provider
  if (actualChainId === null && wagmiSigner && typeof (wagmiSigner as any).getAddress === 'function') {
    const wsProv: any = (wagmiSigner as any).provider
    if (wsProv && typeof wsProv.request === 'function') {
      try {
        const hex = await wsProv.request({ method: 'eth_chainId' })
        if (typeof hex === 'string') {
          actualChainId = parseChainId(hex)
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // If we still couldn't determine chain id, abort with diagnostics
  if (actualChainId === null) {
    const probeInfo: any = {
      probeProviderType: probeProvider ? (probeProvider.constructor && probeProvider.constructor.name) : null,
      probeProviderKeys: probeProvider ? Object.keys(probeProvider).slice(0, 10) : null,
      selectedWalletSnapshot: wallet ? {
        address: wallet.address,
        walletClientType: wallet.walletClientType,
        chainId: wallet.chainId ?? null,
      } : null,
    }
    throw Object.assign(
      new Error(`Could not determine active wallet chain after switch attempt`),
      { __diagnostic: { requestedChainId: desiredChainId, actualChainId: null, probeInfo } }
    )
  }

  // If chain doesn't match, wait for chainChanged event
  if (actualChainId !== desiredChainId) {
    let recheckedChain: number | null = null

    try {
      // Wait for chain change event (8 second timeout)
      recheckedChain = await waitForChainChangeEvent(probeProvider, 8000)
    } catch (e) {
      // ignore
    }

    // If event didn't fire, try one more direct probe using window.ethereum
    if (recheckedChain === null) {
      try {
        const anyWindow: any = typeof window !== 'undefined' ? (window as any) : null
        if (anyWindow && anyWindow.ethereum) {
          try {
            const hex = await anyWindow.ethereum.request({ method: 'eth_chainId' })
            if (typeof hex === 'string') {
              recheckedChain = parseChainId(hex)
            }
          } catch (_) {
            // ignore
          }
        }
      } catch (e) {
        // ignore
      }
    }

    const finalActual = recheckedChain ?? actualChainId
    if (finalActual !== desiredChainId) {
      throw Object.assign(
        new Error(`Wallet did not switch to desired chain. Expected ${desiredChainId} but provider is on ${finalActual}`),
        { __diagnostic: { requestedChainId: desiredChainId, actualChainId: finalActual } }
      )
    }
  }

  // If we don't have a signer yet, or need to re-create it, do so now
  let signer = currentSigner
  if (!signer) {
    const provForSigner = await resolveProvider(wagmiSigner, wagmiProvider, wallet)
    if (provForSigner) {
      try {
        const browserProv = new EthersBrowserProvider(provForSigner as any)
        signer = await browserProv.getSigner(wallet?.address)
      } catch (e) {
        // ignore — we'll rely on previously obtained signer if possible
      }
    }
  }

  return signer
}

/**
 * Extract UID from transaction receipt logs.
 * Searches for EAS attestation event signatures in transaction logs.
 */
function extractUidFromReceipt(receipt: any): string | null {
  try {
    if (!receipt || !receipt.logs) return null
    
    // Search logs for topics that match common EAS Attested events
    for (const log of receipt.logs) {
      const dataStr = log.data || ''
      
      // Some EAS SDKs include the UID in topics[1] or data
      if (log.topics && log.topics.length >= 2) {
        // topics[1] may contain the UID as a bytes32 hex
        const maybe = log.topics[1]
        if (typeof maybe === 'string' && maybe.startsWith('0x') && maybe.length === 66) {
          return maybe
        }
      }
      
      // Fallback: search data for 0x-prefixed 32-byte string
      const match = /0x[0-9a-fA-F]{64}/.exec(dataStr)
      if (match) return match[0]
    }
  } catch (e) {
    // ignore
  }
  return null
}

/**
 * Process EAS transaction: wait for receipt, extract UID, normalize response.
 * Optionally fetches full attestation record via EAS SDK.
 */
export async function processTransactionReceipt(
  tx: any,
  eas: any,
  networkName?: string,
  activeChainId?: number
): Promise<any> {
  let attestationUID: any = null
  
  try {
    attestationUID = await tx.wait()
  } catch (waitErr: any) {
    // SDK sometimes throws after receipt parsing fails; capture error and attached receipt/tx for debugging
    const diagnostic: any = {
      message: waitErr?.message ?? String(waitErr),
      name: waitErr?.name ?? null,
      stack: waitErr?.stack ?? null,
      receipt: waitErr?.receipt ?? null,
      transaction: waitErr?.transaction ?? null,
      txHash: (waitErr?.receipt && waitErr.receipt.transactionHash) 
        || waitErr?.transactionHash 
        || (tx && (tx as any).hash) 
        || null,
    }
    throw Object.assign(
      new Error(diagnostic.message || 'Transaction wait failed'),
      { __diagnostic: diagnostic }
    )
  }

  // The SDK returns UID when waiting; also capture transaction receipt if present
  const receipt = (tx as any).receipt ?? (attestationUID && (attestationUID as any).receipt) ?? null

  // Try to parse UID from logs if SDK didn't return a uid string directly
  const uidFromLogs = extractUidFromReceipt(receipt)

  // Normalize values into compact object with safe string values
  const txHashStr: string | null = (receipt && (receipt.transactionHash as string)) 
    || (receipt && (receipt as any).hash)
    || ((tx as any) && (tx as any).hash) 
    || ((attestationUID as any) && (attestationUID as any).transactionHash)
    || null
  const attestationUIDStr: string | null = typeof attestationUID === 'string' 
    ? attestationUID 
    : ((attestationUID as any) && (attestationUID as any).uid) || null
  const gasUsedStr: string | null = receipt && receipt.gasUsed 
    ? (receipt.gasUsed.toString ? receipt.gasUsed.toString() : String(receipt.gasUsed)) 
    : null

  // Prefer UID from SDK, fallback to parsed logs
  const finalUid = attestationUIDStr || uidFromLogs || null

  const compact: any = {
    txHash: txHashStr,
    attestationUID: finalUid,
    gasUsed: gasUsedStr,
    raw: receipt ?? attestationUID ?? tx,
    network: networkName ?? (activeChainId ? String(activeChainId) : 'unknown'),
  }

  // If we have a UID, try to fetch the attestation record via the SDK for richer data (best-effort)
  if (finalUid && eas) {
    try {
      const fetched = await eas.getAttestation(finalUid)
      compact.rawAttestation = fetched
    } catch (e) {
      // ignore failures
    }
  }

  return compact
}

/**
 * Switch wallet to desired chain with event-driven confirmation.
 * Handles injected wallets (MetaMask, etc.) and embedded wallets differently.
 * Waits for chainChanged event or times out after specified duration.
 * Returns { success: boolean, newChainId: number | null, error?: string }
 */
export async function switchWalletChainWithConfirmation(
  desiredChainId: number,
  wagmiSigner: any,
  wagmiProvider: any,
  wallet?: any,
  options?: {
    timeoutMs?: number
    onChainDetected?: (chainId: number) => void
  }
): Promise<{ success: boolean; newChainId: number | null; error?: string }> {
  const timeoutMs = options?.timeoutMs ?? 10000

  try {
    // Detect wallet type for appropriate handling
    const isInjectedWallet = wallet?.walletClientType && 
      ['metamask', 'coinbase_wallet', 'rainbow', 'wallet_connect'].includes(wallet.walletClientType)
    
    // Send switch request
    if (isInjectedWallet || !wallet?.provider) {
      // Use window.ethereum for injected wallets
      const anyWindow: any = typeof window !== 'undefined' ? window : null
      
      if (anyWindow && anyWindow.ethereum && typeof anyWindow.ethereum.request === 'function') {
        try {
          await anyWindow.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${desiredChainId.toString(16)}` }],
          })
        } catch (switchError: any) {
          // Handle specific error codes
          if (switchError.code === 4902) {
            return {
              success: false,
              newChainId: null,
              error: `CHAIN_NOT_CONFIGURED`,
            }
          } else if (switchError.code === 4001) {
            return {
              success: false,
              newChainId: null,
              error: `USER_REJECTED`,
            }
          }
          throw switchError
        }
      } else {
        return {
          success: false,
          newChainId: null,
          error: 'NO_PROVIDER',
        }
      }
    } else if (wallet?.walletClientType === 'privy') {
      // Embedded Privy wallets cannot switch programmatically
      return {
        success: false,
        newChainId: null,
        error: 'EMBEDDED_WALLET_UNSUPPORTED',
      }
    } else {
      // Fallback to utility for other wallet types
      await switchWalletChain(desiredChainId, wagmiSigner, wagmiProvider, wallet)
    }
    
    // Wait for chainChanged event with timeout
    const switchResult = await new Promise<{ success: boolean; chainId: number | null }>((resolve) => {
      let settled = false
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true
          resolve({ success: false, chainId: null })
        }
      }, timeoutMs)
      
      const anyWindow: any = typeof window !== 'undefined' ? window : null
      
      const handleChainChanged = (chainHex: any) => {
        if (settled) return
        
        try {
          const newChain = parseChainId(chainHex)
          if (newChain === desiredChainId) {
            settled = true
            clearTimeout(timeout)
            
            // Notify callback if provided
            if (options?.onChainDetected) {
              options.onChainDetected(newChain)
            }
            
            // Cleanup listener
            try {
              anyWindow?.ethereum?.removeListener && anyWindow.ethereum.removeListener('chainChanged', handleChainChanged)
            } catch (e) {
              // ignore
            }
            
            resolve({ success: true, chainId: newChain })
          }
        } catch (e) {
          // ignore parse errors
        }
      }
      
      // Attach event listener
      try {
        if (anyWindow && anyWindow.ethereum && typeof anyWindow.ethereum.on === 'function') {
          anyWindow.ethereum.on('chainChanged', handleChainChanged)
        } else {
          // No event listener available, fall back to detection probe
          clearTimeout(timeout)
          setTimeout(async () => {
            if (settled) return
            
            const provider = await resolveProvider(wagmiSigner, wagmiProvider, wallet)
            const detectedChain = await detectChainId(provider, wallet)
            
            settled = true
            
            if (detectedChain === desiredChainId) {
              if (options?.onChainDetected) {
                options.onChainDetected(detectedChain)
              }
              resolve({ success: true, chainId: detectedChain })
            } else {
              resolve({ success: false, chainId: detectedChain })
            }
          }, 2000)
        }
      } catch (e) {
        // Fallback to detection probe
        clearTimeout(timeout)
        setTimeout(async () => {
          if (settled) return
          
          const provider = await resolveProvider(wagmiSigner, wagmiProvider, wallet)
          const detectedChain = await detectChainId(provider, wallet)
          
          settled = true
          resolve({ 
            success: detectedChain === desiredChainId, 
            chainId: detectedChain 
          })
        }, 2000)
      }
    })
    
    return {
      success: switchResult.success,
      newChainId: switchResult.chainId,
      error: switchResult.success ? undefined : 'TIMEOUT_OR_MISMATCH',
    }
  } catch (err: any) {
    return {
      success: false,
      newChainId: null,
      error: err?.message ?? 'UNKNOWN_ERROR',
    }
  }
}

/**
 * Build error diagnostics with user-friendly messages for chain mismatch errors.
 * Returns { userMessage, diagnosticDetails } for UI display.
 */
export function buildErrorDiagnostics(
  error: any,
  activeChainId: number | undefined,
  schemaInfo: any,
  getChainNetworkDetails: () => any
): { userMessage: string; diagnosticDetails: any } {
  try {
    const diagRaw = error && error.__diagnostic ? error.__diagnostic : error
    const diag: any = diagRaw || {}

    // Map chain id -> network name using centralized metadata
    const chains = getChainNetworkDetails()

    const requestedChainFromDiag = parseChainId(diag.requestedChainId ?? diag.requestedChain)
    const actualChainFromDiag = parseChainId(
      diag.actualChainId ?? (diag.cause && diag.cause.__diagnostic && diag.cause.__diagnostic.actualChainId) ?? null
    )
    const selectedWalletChainRaw = diag.probeInfo?.selectedWalletSnapshot?.chainId 
      ?? diag.selectedWalletSnapshot?.chainId 
      ?? null
    const selectedWalletChainParsed = parseChainId(selectedWalletChainRaw)

    let userMessage: string | null = null
    
    // Build user-friendly message for chain mismatch
    if (requestedChainFromDiag && actualChainFromDiag && requestedChainFromDiag !== actualChainFromDiag) {
      const reqName = chains[String(requestedChainFromDiag)]?.chain ?? `chain ${requestedChainFromDiag}`
      const actName = chains[String(actualChainFromDiag)]?.chain ?? `chain ${actualChainFromDiag}`
      userMessage = `Your wallet is on ${actName} (chain ${actualChainFromDiag}) but you selected ${reqName} (chain ${requestedChainFromDiag}). Please switch your wallet network to ${reqName} and try again.`
    } else if (requestedChainFromDiag && (actualChainFromDiag === null || actualChainFromDiag === undefined)) {
      const reqName = chains[String(requestedChainFromDiag)]?.chain ?? `chain ${requestedChainFromDiag}`
      const walletLabel = selectedWalletChainParsed 
        ? (chains[String(selectedWalletChainParsed)]?.chain ?? `chain ${selectedWalletChainParsed}`) 
        : (selectedWalletChainRaw ?? 'your current wallet network')
      userMessage = `Please switch your wallet network to ${reqName} (chain ${requestedChainFromDiag}). Your wallet appears to be on ${walletLabel}. Then retry the submission.`
    }

    const diagnosticDetails = {
      message: diag?.message ?? error?.message ?? String(error),
      name: diag?.name ?? error?.name ?? null,
      stack: diag?.stack ?? error?.stack ?? null,
      txHash: diag?.txHash ?? null,
      receipt: diag?.receipt ?? null,
      transaction: diag?.transaction ?? null,
      requestedChainId: requestedChainFromDiag ?? activeChainId ?? null,
      actualChainId: actualChainFromDiag ?? selectedWalletChainParsed ?? null,
      schemaInfoUsed: schemaInfo ?? null,
      ...(diag && typeof diag === 'object' 
        ? Object.fromEntries(Object.entries(diag).filter(([k]) => !['stack'].includes(k))) 
        : {}),
    }

    return {
      userMessage: userMessage ?? error?.message ?? String(error),
      diagnosticDetails,
    }
  } catch (e) {
    // Fallback if error processing itself fails
    return {
      userMessage: error?.message ?? String(error),
      diagnosticDetails: String(error),
    }
  }
}
