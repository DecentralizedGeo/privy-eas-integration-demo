# Quick Reference: Privy + EAS Integration

## 🎯 The Core Problem & Solution

### Problem

```typescript
// ❌ Privy wallet provider → ethers v6 → EAS SDK = Type mismatch
const provider = await privyWallet.getEthereumProvider();
const ethersProvider = new ethers.BrowserProvider(provider);
const signer = ethersProvider.getSigner();
// EAS SDK rejects this signer format
```

### Solution

```typescript
// ✅ Wagmi hooks → Conversion utils → ethers v6 → EAS SDK = Compatible!
import { useSigner, useProvider } from './eas-wagmi-utils';

const wagmiSigner = useSigner();
const wagmiProvider = useProvider();

const eas = new EAS(easContractAddress);
await eas.connect(wagmiSigner); // Works!
```

## 📦 Key Files

| File | Purpose | Functions |
|------|---------|-----------|
| `eas-wagmi-utils.ts` | Wagmi → ethers v6 conversion | 4 exports |
| `wallet-chain-helpers.ts` | Wallet/chain operations | 11 functions |
| `wallet-address-helpers.ts` | Address resolution | 2 functions |
| `geojson-helpers.ts` | Location data processing | 1 function |

## 🔧 Essential Functions

### Convert Wagmi to ethers v6

```typescript
import { walletClientToSigner, publicClientToProvider } from './eas-wagmi-utils';

// Convert wallet client to signer
const signer = await walletClientToSigner(walletClient);

// Convert public client to provider
const provider = publicClientToProvider(publicClient);
```

### Chain Switching with Confirmation

```typescript
import { switchWalletChainWithConfirmation } from '@/utils/wallet-chain-helpers';

const result = await switchWalletChainWithConfirmation(
  11155111, // Sepolia chain ID
  wagmiSigner,
  wagmiProvider,
  wallet,
  { timeoutMs: 10000 }
);

if (result.success) {
  console.log('Switched to chain:', result.newChainId);
} else {
  console.error('Switch failed:', result.error);
}
```

### Process Transaction Receipt

```typescript
import { processTransactionReceipt } from '@/utils/wallet-chain-helpers';

const tx = await eas.attest(request);
const receipt = await processTransactionReceipt(tx, eas, 'Sepolia', 11155111);

console.log('UID:', receipt.attestationUID);
console.log('Hash:', receipt.txHash);
console.log('Gas:', receipt.gasUsed);
```

### Resolve Wallet Address

```typescript
import { resolveWalletAddress } from '@/utils/wallet-address-helpers';

const address = resolveWalletAddress(
  embeddedWallet,
  linkedAccounts
);
// Returns address from embedded wallet, linked accounts, or injected provider
```

## 🎨 Component Pattern

```typescript
import { usePrivy } from '@privy-io/react-auth';
import { useSigner, useProvider } from './eas-wagmi-utils';
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';

function AttestationForm() {
  const { user, login, authenticated } = usePrivy();
  const wagmiSigner = useSigner();
  const wagmiProvider = useProvider();
  
  const handleSubmit = async () => {
    // 1. Get signer (already compatible!)
    const signer = wagmiSigner;
    
    // 2. Connect EAS
    const eas = new EAS('0xC2679fBD37d54388Ce493F1DB75320D236e1815e');
    await eas.connect(signer);
    
    // 3. Encode data
    const encoder = new SchemaEncoder("string name,string value");
    const encoded = encoder.encodeData([
      { name: "name", value: "Test", type: "string" },
      { name: "value", value: "123", type: "string" }
    ]);
    
    // 4. Submit attestation
    const tx = await eas.attest({
      schema: schemaUID,
      data: {
        recipient: "0x0000000000000000000000000000000000000000",
        expirationTime: 0n,
        revocable: true,
        data: encoded,
      },
    });
    
    // 5. Get receipt
    const receipt = await processTransactionReceipt(tx, eas);
    console.log('Success! UID:', receipt.attestationUID);
  };
  
  return (
    <button onClick={handleSubmit}>Submit Attestation</button>
  );
}
```

## 🔄 Chain Switching Pattern

```typescript
import { switchWalletChainWithConfirmation, detectChainId } from '@/utils/wallet-chain-helpers';

async function ensureCorrectChain(targetChainId: number) {
  // 1. Detect current chain
  const currentChain = await detectChainId(provider, wallet);
  
  // 2. Check if switch needed
  if (currentChain !== targetChainId) {
    // 3. Switch with event confirmation
    const result = await switchWalletChainWithConfirmation(
      targetChainId,
      wagmiSigner,
      wagmiProvider,
      wallet,
      {
        timeoutMs: 10000,
        onChainDetected: (chainId) => {
          console.log('Chain changed to:', chainId);
        }
      }
    );
    
    // 4. Handle result
    if (!result.success) {
      throw new Error(`Failed to switch: ${result.error}`);
    }
  }
}
```

## 🐛 Error Handling

```typescript
try {
  await eas.attest(request);
} catch (error: any) {
  // Check error code
  if (error.code === 4001) {
    console.log('User rejected transaction');
  } else if (error.code === 4902) {
    console.log('Chain not configured in wallet');
    // Prompt user to add chain
  } else if (error.code === -32603) {
    console.log('Insufficient funds or network error');
  }
  
  // Use diagnostic builder
  const { userMessage, diagnosticDetails } = buildErrorDiagnostics(
    error,
    chainId,
    schemaInfo,
    getChainDetails
  );
  
  console.error(userMessage);
  console.debug(diagnosticDetails);
}
```

## 📊 Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `4001` | User rejected | Show "Transaction cancelled" |
| `4902` | Chain not added | Prompt to add chain |
| `-32603` | Internal error | Check balance, retry |
| `-32602` | Invalid params | Check attestation data |

## ✅ Testing Checklist

```typescript
// Test all wallet types
- [ ] Privy embedded wallet
- [ ] MetaMask injected
- [ ] Coinbase Wallet
- [ ] WalletConnect

// Test chain operations
- [ ] Detect current chain
- [ ] Switch chain (single click)
- [ ] Verify chain after switch
- [ ] Handle switch rejection

// Test attestations
- [ ] Create attestation
- [ ] Extract UID from receipt
- [ ] Extract txHash
- [ ] View on EASScan
- [ ] Handle transaction failure

// Test error scenarios
- [ ] Wrong chain
- [ ] Insufficient funds
- [ ] User rejection
- [ ] Network timeout
- [ ] Invalid schema data
```

## 🚀 Performance Tips

1. **Memoize providers**: Use `useMemo` to avoid recreating providers
2. **Debounce chain checks**: Don't check chain on every render
3. **Event listeners**: Use event-driven approach over polling
4. **Cleanup listeners**: Remove event listeners in useEffect cleanup
5. **Batch operations**: Combine multiple checks when possible

## 📚 Learn More

- **[Full Integration Guide](./privy-eas-integration.md)** - Complete documentation
- **[Architecture Diagrams](./architecture-diagrams.md)** - Visual flowcharts
- **[Main README](../README.md)** - Project overview

## 💡 Pro Tips

1. **Always verify chain after switching** - Don't trust the RPC response alone
2. **Use event listeners with timeouts** - Combine async events with fallback timers
3. **Check multiple receipt locations** - Different SDKs return data in different places
4. **Provide user feedback** - Show loading states during chain switches
5. **Log diagnostics in dev** - Full error objects help debugging

---

**Quick Start**: Copy the component pattern above and replace schema/data with your needs. The wagmi hooks handle all wallet complexity! 🎉
