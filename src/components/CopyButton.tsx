import React, { useState } from 'react'

export default function CopyButton({
  value,
  label = 'Copy',
}: {
  value: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.warn('copy failed', e)
    }
  }

  return (
    <button onClick={doCopy} disabled={copied} style={{ padding: '6px 8px', borderRadius: 8, display: 'inline-flex', gap: 8, alignItems: 'center' }} aria-label={copied ? 'Copied' : `Copy ${label}`}>
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.285 6.708a1 1 0 0 0-1.414-1.415l-9.193 9.192-3.657-3.657a1 1 0 0 0-1.414 1.414l4.364 4.364a1 1 0 0 0 1.414 0l10.6-10.898z" fill="#0f172a"/></svg>
          <span style={{ fontSize: 13 }}>Copied</span>
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 21H8a2 2 0 0 1-2-2V7h2v12h8v2z" fill="#0f172a"/><path d="M20 3H12a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" fill="#0f172a"/></svg>
          <span style={{ fontSize: 13 }}>{label}</span>
        </>
      )}
    </button>
  )
}
