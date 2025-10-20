import React, { useState } from 'react'
import { useWallets } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import CopyButton from './CopyButton'

export default function SendMessageCard() {
  const { wallets } = useWallets()
  const [message, setMessage] = useState('This is a test message for signing.')
  const [signature, setSignature] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addNonce, setAddNonce] = useState(false)
  const [addTimestamp, setAddTimestamp] = useState(false)
  const [nonce, setNonce] = useState<string>(() => generateNonce())
  const [previewTimestamp, setPreviewTimestamp] = useState<string | null>(null)

  const getProviderFromWallets = async () => {
    try {
      const embedded = wallets?.find((w: any) => w.walletClientType === 'privy')
      if (embedded && typeof embedded.getEthereumProvider === 'function') {
        return await embedded.getEthereumProvider()
      }
    } catch (e) {
      // fall through to injected
    }
    // Fallback to injected provider (MetaMask etc.)
    const anyWindow: any = window
    if (anyWindow?.ethereum) return anyWindow.ethereum
    return null
  }

  const handleSign = async () => {
    setError(null)
    setSignature(null)
    setLoading(true)
    try {
      const providerLike: any = await getProviderFromWallets()
      if (!providerLike) throw new Error('No wallet provider found')
      // build the final message including optional nonce and timestamp
      const parts: string[] = [message]
      if (addNonce) parts.push(`nonce:${nonce}`)
      // use the previewTimestamp captured at toggle time (or capture now if not set)
      const ts = addTimestamp ? (previewTimestamp ?? new Date().toISOString()) : null
      if (ts) parts.push(`timestamp:${ts}`)
      const finalMessage = parts.join('\n')

      const provider = new ethers.BrowserProvider(providerLike)
      const signer = await provider.getSigner()
      const sig = await signer.signMessage(finalMessage)
      setSignature(sig)
    } catch (e: any) {
      console.error('sign failed', e)
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!signature) return
    try {
      await navigator.clipboard.writeText(signature)
      setCopiedSignature(true)
      setTimeout(() => setCopiedSignature(false), 2000)
    } catch (e) {
      console.warn('copy failed', e)
    }
  }

  const [copiedSignature, setCopiedSignature] = useState<boolean>(false)
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false)

  // Update preview timestamp when addTimestamp toggles on
  React.useEffect(() => {
    if (addTimestamp) setPreviewTimestamp(new Date().toISOString())
    else setPreviewTimestamp(null)
  }, [addTimestamp])

  function generateNonce() {
    try {
      const arr = new Uint32Array(3)
      crypto.getRandomValues(arr)
      return Array.from(arr).map((v) => v.toString(16)).join('')
    } catch (e) {
      return Math.floor(Math.random() * 1e9).toString()
    }
  }

  const _regenerateNonce = () => setNonce(generateNonce())

  return (
  <div className="card" style={{ maxWidth: 800, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ flex: '0 0 auto' }}>
        <h3>Sign a Message</h3>
        <p>Sign a short message with your connected wallets private key.</p>
        <p>To verify that it was really signed by this wallet address, visit etherscans <a href="https://etherscan.io/verifiedSignatures" target="_blank">verified signatures tool</a> and copy the below details.</p>
        <div style={{ display: 'flex', gap: 5, marginTop: 12 }}>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} style={{ flex: 1, minWidth: 0 }} />
          <div style={{ width: 140, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={addNonce} onChange={(e) => { setAddNonce(e.target.checked); setNonce(generateNonce()) }} />
              <span> Add nonce</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={addTimestamp} onChange={(e) => setAddTimestamp(e.target.checked)} />
              <span> Add timestamp</span>
            </label>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleSign} className="btn-primary button-base" disabled={loading}>{loading ? 'Signing…' : 'Sign Message'}</button>
          <CopyButton value={signature ?? ''} label="Copy signature" />

          <CopyButton value={[message, addNonce ? `nonce:${nonce}` : null, addTimestamp ? `timestamp:${previewTimestamp}` : null].filter(Boolean).join('\n')} label="Copy message" />
        </div>
      </div>

      {error && <div style={{ marginTop: 8, color: 'crimson' }}>{error}</div>}

      {signature && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Signed message</div>
          <pre className="wrapped-signature" style={{ maxHeight: 120, overflow: 'auto', background: '#f6f6f6', padding: 8 }}>{signature}</pre>
        </div>
      )}

  <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Message to be signed (preview)</div>
        <pre style={{ maxHeight: 160, overflow: 'auto', background: '#fff', padding: 8 }}>{[message, addNonce ? `nonce:${nonce}` : null, addTimestamp ? `timestamp:${previewTimestamp}` : null].filter(Boolean).join('\n')}</pre>
      </div>
    </div>
  )
}
