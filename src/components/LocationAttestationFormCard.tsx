import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk-v2'
import { useWallets } from '@privy-io/react-auth'
import { useSigner as useWagmiSigner, useProvider as useWagmiProvider } from '../eas-wagmi-utils'
import { getChainNetworkDetails, DEFAULT_SCHEMA_STRING } from '../config/eas-config'
import {
  resolveSigner,
  switchWalletChain,
  verifyWalletChain,
  processTransactionReceipt,
  buildErrorDiagnostics,
  resolveProvider,
  detectChainId,
  parseChainId,
  switchWalletChainWithConfirmation,
} from '../utils/wallet-chain-helpers'
import { processGeoJsonFeature } from '../utils/geojson-helpers'

// chain mapping is now provided by dynamic config loader (see src/config/eas-config.ts)

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

export default function LocationAttestationFormCard({ chainId, initialFeature, onClearFeature }: { chainId?: number | undefined; initialFeature?: any | null; onClearFeature?: (v: any) => void }) {
  // Required fields
  // Leaflet uses EPSG:3857 (WebMercator) for its projection; use that as default SRS for geometry produced by the map
  const [srs, setSrs] = useState('EPSG:3857')
  const [locationType, setLocationType] = useState('coordinate-decimal+lat-lon')
  const [location, setLocation] = useState('40.7128,-74.0060')
  const [eventTimestamp, setEventTimestamp] = useState<number>(() => Math.floor(Date.now() / 1000))

  // Optional array fields (comma-separated strings)
  const [recipeType, setRecipeType] = useState('')
  const [recipePayload, setRecipePayload] = useState('')
  const [mediaType, setMediaType] = useState('')
  const [mediaData, setMediaData] = useState('')
  const [memo, setMemo] = useState('')

  // If an initial feature (GeoJSON) is provided, populate location and locationType
  useEffect(() => {
    if (!initialFeature) return
    
    const processed = processGeoJsonFeature(initialFeature)
    if (processed) {
      setLocation(processed.location)
      setLocationType(processed.locationType)
    }
  }, [initialFeature])

  const { wallets } = useWallets() as any
  const wagmiSigner = useWagmiSigner()
  const wagmiProvider = useWagmiProvider()

  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [response, setResponse] = useState<any | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // capture structured error details (stack, full object) for debugging in UI
  const [errorDetails, setErrorDetails] = useState<any | null>(null)
  // Detected wallet chain (numeric) for pre-submit banner and UI
  const [detectedWalletChain, setDetectedWalletChain] = useState<number | null>(null)

  // Use chainId passed from parent (header) as authoritative. If not provided, try to derive from provider/signer.
  const activeChainId = useMemo(() => {
    if (typeof chainId === 'number') return chainId
    try {
      const anyProv: any = wagmiProvider
      if (anyProv && anyProv.network && typeof anyProv.network.chainId === 'number') return anyProv.network.chainId
      const anySigner: any = wagmiSigner
      if (anySigner && anySigner.provider && anySigner.provider.network && typeof anySigner.provider.network.chainId === 'number') return anySigner.provider.network.chainId
    } catch (e) {
      // ignore
    }
    return undefined as unknown as number
  }, [chainId, wagmiProvider, wagmiSigner])

  const schemaInfo = useMemo(() => {
    // Use local network metadata mapping (preferred) — this removes dependency on remote config at runtime
    const chains = getChainNetworkDetails()
    const rec = activeChainId ? chains[String(activeChainId)] : undefined
    return {
      schemaUID: rec?.schemaUID ?? null,
      easContractAddress: rec?.easContractAddress ?? null,
      networkName: rec?.chain ?? (activeChainId ? String(activeChainId) : null),
    }
  }, [activeChainId])

  // Helper: probe the connected wallet/provider for its current chain id (numeric) using multiple strategies
  const probeWalletChain = useCallback(async (): Promise<number | null> => {
    try {
      // Resolve provider from wagmi or wallets
      const provider = await resolveProvider(
        wagmiSigner,
        wagmiProvider,
        wallets && wallets.length > 0 ? wallets[0] : undefined
      )

      // Detect chain ID using all available strategies
      const chainId = await detectChainId(
        provider,
        wallets && wallets.length > 0 ? wallets[0] : undefined
      )

      return chainId
    } catch (e) {
      return null
    }
  }, [wagmiProvider, wagmiSigner, wallets])

  // Keep detectedWalletChain up to date and subscribe to wallet chain changes if possible
  useEffect(() => {
    let mounted = true
    const refresh = async () => {
      const c = await probeWalletChain()
      if (!mounted) return
      setDetectedWalletChain(c)
    }
    refresh()

    const anyWindow: any = typeof window !== 'undefined' ? (window as any) : null
    const handleChainChanged = (hex: any) => {
      // Parse chain ID using utility
      try {
        const n = parseChainId(hex)
        setDetectedWalletChain(n)
      } catch (e) {
        setDetectedWalletChain(null)
      }
    }

    if (anyWindow && anyWindow.ethereum && typeof anyWindow.ethereum.on === 'function') {
      try {
        anyWindow.ethereum.on('chainChanged', handleChainChanged)
      } catch (e) {
        // ignore
      }
    }

    return () => {
      mounted = false
      try {
        if (anyWindow && anyWindow.ethereum && typeof anyWindow.ethereum.removeListener === 'function') anyWindow.ethereum.removeListener('chainChanged', handleChainChanged)
      } catch (e) {
        // ignore
      }
    }
  }, [probeWalletChain])

  // Allow clicking the button even when chain isn't detected so we can attempt to switch the network programmatically.
  const submitDisabled = status === 'submitting' || status === 'success'

  const buildEncodedData = () => {

    const schemaEncoder = new SchemaEncoder(DEFAULT_SCHEMA_STRING)

    // Smart splitting of comma-separated inputs into arrays; if splitting yields no non-empty items, keep a single-element array with the raw string
    const splitOrSingle = (txt: string) => {
      if (!txt) return [] as string[]
      const parts = txt.split(',').map((s) => s.trim()).filter(Boolean)
      return parts.length > 0 ? parts : [txt]
    }

    const recipeTypeArr = splitOrSingle(recipeType)
    const recipePayloadArr = splitOrSingle(recipePayload)
    const mediaTypeArr = splitOrSingle(mediaType)
    const mediaDataArr = splitOrSingle(mediaData)

    const encodedData = schemaEncoder.encodeData([
      { name: 'eventTimestamp', value: BigInt(eventTimestamp).toString(), type: 'uint256' },
      { name: 'srs', value: srs, type: 'string' },
      { name: 'locationType', value: locationType, type: 'string' },
      { name: 'location', value: location, type: 'string' },
      { name: 'recipeType', value: recipeTypeArr, type: 'string[]' },
      { name: 'recipePayload', value: recipePayloadArr, type: 'bytes[]' },
      { name: 'mediaType', value: mediaTypeArr, type: 'string[]' },
      { name: 'mediaData', value: mediaDataArr, type: 'string[]' },
      { name: 'memo', value: memo, type: 'string' },
    ])

    return encodedData
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    ;(async () => {
      // If no chain is active, instruct user to switch via the header selector (the header controls the active network)
      if (!activeChainId) {
        setStatus('error')
        setErrorMessage('No active chain selected. Please select a network using the selector in the header.')
        return
      }

      setStatus('submitting')
      setResponse(null)
      setErrorMessage(null)
      setErrorDetails(null)

      try {
        // Step 1: Resolve signer and wallet
        const { signer: initialSigner, selectedWallet } = await resolveSigner(
          wallets,
          wagmiSigner,
          wagmiProvider
        )
        let signer = initialSigner

        // Step 2: If a specific chain was requested, switch to it
        const desiredChainId = typeof chainId === 'number' ? chainId : undefined
        if (typeof desiredChainId === 'number') {
          // Attempt to switch the wallet
          await switchWalletChain(desiredChainId, wagmiSigner, wagmiProvider, selectedWallet)

          // Verify the switch succeeded and wait if needed
          signer = await verifyWalletChain(
            desiredChainId,
            wagmiSigner,
            wagmiProvider,
            selectedWallet,
            signer
          )
        }

        // Step 3: Build encoded data for EAS
        const encodedData = buildEncodedData()

        // Step 4: Ensure we have chain metadata
        if (!schemaInfo || !schemaInfo.easContractAddress || !schemaInfo.schemaUID) {
          throw new Error(
            `Chain metadata for chain ${activeChainId ?? 'unknown'} is missing. Ensure the selected network exists in NETWORK_METADATA.`
          )
        }

        const easContractAddress = schemaInfo.easContractAddress
        const schemaUID = schemaInfo.schemaUID

        // Step 5: Create and submit attestation
        const eas = new EAS(easContractAddress)
        await eas.connect(signer)

        const tx = await eas.attest({
          schema: schemaUID,
          data: {
            recipient: selectedWallet.address,
            expirationTime: 0n,
            revocable: true,
            data: encodedData,
          },
        })

        // Step 6: Process transaction receipt
        const compact = await processTransactionReceipt(
          tx,
          eas,
          schemaInfo.networkName ?? undefined,
          activeChainId
        )

        setResponse(compact)
        setStatus('success')
      } catch (err: any) {
        // Build user-friendly error diagnostics
        const { userMessage, diagnosticDetails } = buildErrorDiagnostics(
          err,
          activeChainId,
          schemaInfo,
          getChainNetworkDetails
        )

        setErrorMessage(userMessage)
        setErrorDetails(diagnosticDetails)
        setStatus('error')
      }
    })()
  }

  const onReset = () => {
    setSrs('EPSG:3857')
    setLocationType('coordinate-decimal+lat-lon')
    setLocation('40.7128,-74.0060')
    setEventTimestamp(Math.floor(Date.now() / 1000))
    setRecipeType('')
    setRecipePayload('')
    setMediaType('')
    setMediaData('')
    setMemo('')
    setStatus('idle')
    setResponse(null)
    setErrorMessage(null)
    setErrorDetails(null)
    if (typeof onClearFeature === 'function') onClearFeature(null)
  }

  // Attempt to programmatically switch user's wallet to the header-selected network (best-effort)
  const attemptProgrammaticSwitch = async () => {
    if (!activeChainId) {
      console.log('[attemptProgrammaticSwitch] No active chain ID')
      return
    }
    
    console.log('[attemptProgrammaticSwitch] Attempting to switch to chain:', activeChainId)
    console.log('[attemptProgrammaticSwitch] Current detected chain:', detectedWalletChain)
    
    const activeWallet = wallets && wallets.length > 0 ? wallets[0] : undefined
    
    try {
      const result = await switchWalletChainWithConfirmation(
        activeChainId,
        wagmiSigner,
        wagmiProvider,
        activeWallet,
        {
          timeoutMs: 10000,
          onChainDetected: (newChainId) => {
            console.log('[attemptProgrammaticSwitch] Chain changed to:', newChainId)
            setDetectedWalletChain(newChainId)
          },
        }
      )
      
      if (result.success) {
        console.log('[attemptProgrammaticSwitch] ✅ Switch successful!')
      } else {
        console.log('[attemptProgrammaticSwitch] ⚠️ Switch failed:', result.error)
        
        // Update detected chain if we got one back
        if (result.newChainId !== null) {
          setDetectedWalletChain(result.newChainId)
        }
        
        // Show user-friendly error messages
        let userMessage = ''
        switch (result.error) {
          case 'CHAIN_NOT_CONFIGURED':
            userMessage = `Chain ${activeChainId} (${schemaInfo?.networkName}) is not configured in your wallet. Please add it manually first.`
            break
          case 'USER_REJECTED':
            userMessage = 'You declined the network switch request.'
            break
          case 'NO_PROVIDER':
            userMessage = 'No wallet provider found. Please ensure your wallet extension is enabled.'
            break
          case 'EMBEDDED_WALLET_UNSUPPORTED':
            userMessage = 'Embedded Privy wallets cannot switch chains programmatically. Please use the header dropdown to select a different network.'
            break
          case 'TIMEOUT_OR_MISMATCH':
            userMessage = 'Chain switch timed out or wallet is still on a different network.'
            break
          default:
            userMessage = result.error ?? 'Unknown error occurred during chain switch.'
        }
        
        if (userMessage) {
          alert(`Chain switch failed: ${userMessage}\n\nPlease manually switch your wallet network to ${schemaInfo?.networkName ?? `chain ${activeChainId}`}.`)
        }
      }
    } catch (e: any) {
      console.error('[attemptProgrammaticSwitch] Unexpected error:', e)
      alert(`Chain switch failed: ${e?.message ?? 'Unknown error'}\n\nPlease manually switch your wallet network to ${schemaInfo?.networkName ?? `chain ${activeChainId}`}.`)
    }
  }

  const easScanUrl = (uid: string | null | undefined): string | undefined => {
    if (!uid) return undefined
    const network = schemaInfo.networkName || 'sepolia'
    return `https://${network}.easscan.org/attestation/view/${uid}`
  }

  return (
    <div className="card">
      <form onSubmit={onSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>Create a Location Attestation</h3>
          {schemaInfo && schemaInfo.schemaUID ? (
            <a
              href={`https://${schemaInfo.networkName}.easscan.org/schema/view/${schemaInfo.schemaUID}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 13 }}
            >
              View schema
            </a>
          ) : (
            <span style={{ fontSize: 13 }}>{schemaInfo?.networkName ?? 'Network'}</span>
          )}
        </div>
        <p>Fill out and submit an on-chain location attestation to the EAS {schemaInfo.networkName} network.</p>

        <div className="form-row">
          <label>SRS</label>
          <input value={srs} onChange={(e) => setSrs(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Location Type</label>
          <input value={locationType} onChange={(e) => setLocationType(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Event Timestamp (unix seconds)</label>
          <input type="number" value={String(eventTimestamp)} onChange={(e) => setEventTimestamp(Number(e.target.value))} />
        </div>

        <div className="form-row">
          <label>Recipe Type (comma-separated)</label>
          <input value={recipeType} onChange={(e) => setRecipeType(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Recipe Payload (comma-separated bytes/base64)</label>
          <input value={recipePayload} onChange={(e) => setRecipePayload(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Media Type (comma-separated)</label>
          <input value={mediaType} onChange={(e) => setMediaType(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Media Data (comma-separated urls/base64)</label>
          <input value={mediaData} onChange={(e) => setMediaData(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Memo</label>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>

        <div className="form-actions">
          {/* Inline banner showing requested vs detected chain ONLY when there's a mismatch */}
          {wallets && wallets.length > 0 && typeof activeChainId === 'number' && detectedWalletChain !== null && detectedWalletChain !== activeChainId && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ padding: '8px', background: '#fff4e5', borderRadius: 6 }}>
                <div style={{ fontSize: 13 }}>
                  <strong>Requested:</strong> {schemaInfo?.networkName ?? `chain ${activeChainId}`} (chain {activeChainId})
                  {' '}|{' '}
                  <strong>Wallet:</strong> {getChainNetworkDetails()[String(detectedWalletChain)]?.chain ?? `chain ${detectedWalletChain}`} (chain {detectedWalletChain})
                </div>
                <div style={{ marginTop: 6 }}>
                  <button type="button" className="button-base" onClick={attemptProgrammaticSwitch} style={{ padding: '6px 8px', outline: "1px solid", cursor: 'pointer' }}>
                    Switch wallet network
                  </button>
                  <span style={{ marginLeft: 8, fontSize: 12 }}>
                    If switching fails, open your wallet and change the network to {schemaInfo?.networkName ?? `chain ${activeChainId}`}
                  </span>
                </div>
              </div>
            </div>
          )}
          <button type="submit" className="btn-primary button-base" disabled={submitDisabled}>
            {status === 'idle' && (!activeChainId ? 'Connect / Switch Network' : 'Submit Attestation')}
            {status === 'submitting' && 'Submitting Attestation…'}
            {status === 'success' && '✓ Attestation Submitted'}
            {status === 'error' && 'Submission Failed'}
          </button>
          <button type="button" style={{ marginLeft: 8 }} onClick={onReset}>
            {status === 'success' ? 'Submit Another' : 'Reset'}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 12, background: '#fafafa', padding: 8, fontSize: 12 }}>
        <strong>Response</strong>
        <div style={{ marginTop: 8 }}>
          {status === 'submitting' && <div>Submitting — waiting for confirmation…</div>}
          {status === 'error' && <div style={{ color: 'crimson' }}>Error: {errorMessage}</div>}
          {status === 'error' && errorDetails && (
            <div style={{ marginTop: 8 }}>
              <details>
                <summary style={{ cursor: 'pointer' }}>Error details (expand)</summary>
                <pre className="json-response" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(errorDetails, null, 2)}</pre>
              </details>
            </div>
          )}
          {status === 'success' && response && (
            <div>
              <div>txHash: {response.txHash ?? 'unknown'}</div>
              <div>attestationUID: {response.attestationUID ?? 'unknown'}</div>
              <div>gasUsed: {response.gasUsed ?? 'unknown'}</div>
              {response.attestationUID && (
                <div>
                  <a target="_blank" rel="noreferrer" href={easScanUrl(response.attestationUID)}>
                    View on EASScan
                  </a>
                </div>
              )}

              <details style={{ marginTop: 8 }}>
                <summary>Raw response</summary>
                <pre className="json-response">{JSON.stringify(response.raw ?? response, null, 2)}</pre>
              </details>
            </div>
          )}

          {status === 'idle' && <div>The attestation response details will appear here once submission is complete</div>}
        </div>
      </div>
    </div>
  )
}
