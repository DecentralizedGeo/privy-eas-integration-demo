import React, { useState } from 'react'
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk-v2'
import { useWallets } from '@privy-io/react-auth'
import { useSigner as useWagmiSigner } from '../eas-wagmi-utils'
import { BrowserProvider as EthersBrowserProvider } from 'ethers'

export default function AttestationForm() {
  const [name, setName] = useState('Regular Attestation User')
  const [age, setAge] = useState<number | string>(30)
  const [nickname, setNickname] = useState('regular_user')
  const { wallets } = useWallets() as any
  const wagmiSigner = useWagmiSigner()

  // EAS config (example values) — replace with your contract/schema when ready
  const easContractAddress = '0xC2679fBD37d54388Ce493F1DB75320D236e1815e'
  const schemaUID = '0xf243d8739790d68e3a53c29dffb187cce1d572179e01f49f07a5ae36c8205f35'

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: String(name),
      age: Number(age),
      nickname: String(nickname),
    }

    ;(async () => {
      try {
        if (!wallets || wallets.length === 0) throw new Error('No connected wallets')

  // Debug info (helps when troubleshooting which provider is used)
  // Use console.log to ensure visibility in browsers where debug-level logs are hidden
  // eslint-disable-next-line no-console
  console.log('wallets:', wallets)
  // Print details about each wallet object to find provider field
  // eslint-disable-next-line no-console
  wallets.forEach((w: any, i: number) => console.log(`wallet[${i}] keys:`, Object.keys(w), 'provider?', !!w.provider, 'raw:', w))

        // Prefer to use the wagmi-derived signer when its address matches one of the Privy wallets.
        let signer = wagmiSigner
        let selectedWallet: any = undefined

        if (signer) {
          try {
            const signerAddress = await signer.getAddress()
            selectedWallet = wallets.find((w: any) => w.address && w.address.toLowerCase() === signerAddress.toLowerCase())
            if (selectedWallet) {
              // eslint-disable-next-line no-console
              console.debug('Using wagmi signer matching wallet:', signerAddress)
            } else {
              // eslint-disable-next-line no-console
              console.debug('wagmi signer address does not match any Privy wallet; will try other fallbacks', signer)
            }
          } catch (err) {
            // signer.getAddress() may fail; continue to fallbacks
            // eslint-disable-next-line no-console
            console.debug('Could not get address from wagmi signer:', err)
          }
        }

        // If we don't have a selected wallet yet, prefer a non-injected (likely embedded) provider
        if (!selectedWallet) {
          selectedWallet = wallets.find((w: any) => w.provider && !w.provider?.isMetaMask && !w.provider?.isCoinbaseWallet) || wallets[0]
          // eslint-disable-next-line no-console
          console.debug('Selected wallet via fallback:', selectedWallet)
        }

        // If we still don't have an ethers Signer, build one from the selected wallet provider
        if (!signer) {
          if (!selectedWallet) {
            throw new Error('No connected wallet available. Connect a wallet or create an embedded wallet in Privy.')
          }

          // Attempt to find a provider on known paths. Some wallet objects expose a provider directly
          // while Privy's embedded wallet exposes an accessor like `getEthereumProvider()`.
          let rawProvider: any = selectedWallet.provider ?? null

          // Try common accessors if provider isn't present
          if (!rawProvider) {
            try {
              if (typeof selectedWallet.getEthereumProvider === 'function') {
                // eslint-disable-next-line no-console
                console.log('Calling selectedWallet.getEthereumProvider() to obtain provider')
                rawProvider = await selectedWallet.getEthereumProvider()
              } else if (selectedWallet.walletClient && selectedWallet.walletClient.provider) {
                // some objects may nest provider under walletClient
                rawProvider = selectedWallet.walletClient.provider
              } else if (selectedWallet.client && selectedWallet.client.provider) {
                rawProvider = selectedWallet.client.provider
              }
            } catch (err) {
              // eslint-disable-next-line no-console
              console.warn('Error while calling provider accessor on selectedWallet:', err)
            }
          }

          if (!rawProvider) {
            // Provide a helpful message for the UI
            throw new Error('No connected wallet provider available. Connect a wallet or create an embedded wallet in Privy.')
          }

          try {
            const browserProvider = new EthersBrowserProvider(rawProvider as any)
            signer = await browserProvider.getSigner(selectedWallet.address)
            // eslint-disable-next-line no-console
            console.log('Created fallback ethers signer from selected wallet provider (via accessor)')
          } catch (err) {
            console.warn('Fallback signer creation failed:', err)
            throw new Error('Failed to create an ethers signer from the connected wallet provider')
          }
        }

        // Quick balance check to provide a clearer error before attempting to submit a transaction
        try {
          // Note: Balance check could be added here if needed, but currently using provider fallbacks
          const minWei = 1n
        } catch (err) {
          // rethrow (caught by outer catch) with helpful message
          throw err
        }

        // encode EAS data
        const schemaEncoder = new SchemaEncoder('string name,uint8 age,string nickname')
        const encodedData = schemaEncoder.encodeData([
          { name: 'name', value: payload.name, type: 'string' },
          { name: 'age', value: payload.age.toString(), type: 'uint8' },
          { name: 'nickname', value: payload.nickname, type: 'string' },
        ])

        // connect EAS and submit attestation as a transaction
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

        const receipt = await tx.wait()
        console.log('Attestation tx receipt:', receipt)
        alert('Attestation submitted — see console for tx receipt')
      } catch (err: any) {
        console.error('EAS attestation failed:', err)
        alert('EAS attestation failed: ' + (err?.message ?? err))
      }
    })()
  }

  return (
    <div className="card form-card">
      <form onSubmit={onSubmit}>
        <h3 style={{ marginTop: 0 }}>Attestation (Simple Schema)</h3>

        <div className="form-row">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Age</label>
          <input type="number" min={0} max={255} value={String(age)} onChange={(e) => setAge(Number(e.target.value))} />
        </div>

        <div className="form-row">
          <label>Nickname</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary button-base">Submit Attestation</button>
        </div>
      </form>
      <div style={{ marginTop: 12, background: '#fafafa', padding: 8, fontSize: 12 }}>
        <strong>Debug wallets:</strong>
        <pre style={{ maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(wallets ?? 'no wallets', null, 2)}</pre>
      </div>
    </div>
  )
}
