# Documentation

This directory contains comprehensive documentation for integrating Privy's embedded wallet functionality with the Ethereum Attestation Service (EAS) using ethers v6.

## 📚 Documentation Files

### [privy-eas-integration.md](./privy-eas-integration.md)

Complete integration guide covering:

- The signer compatibility problem and solution
- Architecture overview with flowchart and sequence diagrams
- Implementation details for all utility functions
- Multi-wallet support (Privy, MetaMask, Coinbase, Rainbow, WalletConnect)
- Chain switching with event-driven confirmation
- Creating attestations with EAS SDK
- Common issues and solutions
- Testing checklist

### [architecture-diagrams.md](./architecture-diagrams.md)

Visual reference diagrams:

- Quick signer conversion flow
- Component architecture
- Attestation submission sequence
- Chain switching state machine
- Data flow from form to transaction receipt
- Error handling strategy

## 🎯 Quick Start

The main challenge when integrating Privy with EAS is that Privy's wallet signers are not directly compatible with EAS SDK's expected signer format.

### ❌ What Doesn't Work

```typescript
const provider = await wallet.getEthereumProvider();
const ethersProvider = new ethers.BrowserProvider(provider);
const signer = ethersProvider.getSigner();

const eas = new EAS(easContractAddress);
await eas.connect(signer); // Type mismatch!
```

### ✅ The Solution

Use Wagmi hooks with conversion utilities from `eas-wagmi-utils.ts`:

```typescript
import { useSigner } from './eas-wagmi-utils';

function MyComponent() {
  const wagmiSigner = useSigner();
  
  const eas = new EAS(easContractAddress);
  await eas.connect(wagmiSigner); // Works perfectly!
}
```

## 🔧 Key Utility Files

### `eas-wagmi-utils.ts`

Converts Wagmi's wallet/public clients to ethers v6 compatible signers and providers:

- `walletClientToSigner(walletClient)` → JsonRpcSigner
- `publicClientToProvider(publicClient)` → JsonRpcProvider
- `useSigner()` hook → Returns ethers v6 signer
- `useProvider()` hook → Returns ethers v6 provider

### `wallet-chain-helpers.ts` (740 lines, 11 functions)

Comprehensive wallet and chain operations:

- Parse chain IDs from multiple formats
- Resolve providers and signers with fallback strategies
- Detect current chain using multiple methods
- Switch chains with event-driven confirmation
- Verify wallet is on correct chain
- Process transaction receipts and extract UIDs
- Build user-friendly error diagnostics

### `wallet-address-helpers.ts` (45 lines, 2 functions)

Wallet address resolution for all wallet types:

- `resolveWalletAddress()` - Get address from embedded/linked/injected wallets
- `getWindowEthereum()` - Safe window.ethereum access

### `geojson-helpers.ts` (45 lines, 1 function)

GeoJSON processing for location attestations:

- `processGeoJsonFeature()` - Handle Point/LineString/Polygon features

## 📊 Diagrams Overview

### [Architecture Flow](./architecture-diagrams.md#component-architecture)

Shows the complete flow from user authentication through attestation submission:

1. User authentication with Privy
2. Wallet creation/connection
3. Wagmi hooks activation
4. Signer/provider conversion
5. EAS connection
6. Chain verification/switching
7. Attestation submission
8. Receipt processing

### [Sequence Diagram](./architecture-diagrams.md#attestation-submission-sequence)

Detailed interaction between components:

- Privy Auth → Privy Wallet
- Wagmi Hooks → eas-wagmi-utils
- ethers v6 conversion
- EAS SDK integration
- Blockchain communication
- Event-driven chain switching
- Transaction receipt processing

## 🚀 Implementation Example

See `LocationAttestationFormCard.tsx` for a complete working example demonstrating:

1. **Multi-wallet support**: Works with Privy embedded wallets, MetaMask, and other providers
2. **Chain mismatch detection**: Automatically detects if user is on wrong network
3. **Event-driven chain switching**: Switches network and waits for confirmation
4. **Schema encoding**: Properly encodes attestation data according to schema
5. **Transaction processing**: Submits transaction and extracts UID from receipt
6. **Error handling**: User-friendly error messages with diagnostic information
7. **UX best practices**: Loading states, success feedback, "Submit Another" workflow

## 🔗 Resources

- [Privy Documentation](https://docs.privy.io/) - Wallet integration
- [EAS SDK Documentation](https://docs.attest.sh/) - Attestation service
- [ethers v6 Documentation](https://docs.ethers.org/v6/) - Ethereum library
- [Wagmi Documentation](https://wagmi.sh/) - React hooks for Ethereum
- [Mermaid Documentation](https://mermaid.js.org/) - Diagram syntax

## 💡 Key Insights

1. **Wagmi as Bridge**: Wagmi's abstraction layer provides a consistent interface for all wallet types
2. **Transport Layer**: The `transport` object from wagmiClient is the key to ethers v6 compatibility
3. **Event-Driven > Polling**: Using `chainChanged` events is more reliable than polling or fixed timeouts
4. **Multiple Fallbacks**: Check multiple locations for transaction data (hash, UID) due to SDK variations
5. **Type Safety**: Proper TypeScript typing prevents runtime errors with wallet interactions

## 🐛 Common Pitfalls

1. **Don't use `wallet.provider` directly** - It may be undefined for some wallet types
2. **Don't rely on fixed timeouts** - Use event listeners with timeout fallbacks
3. **Don't assume receipt structure** - Check multiple possible locations for txHash and UID
4. **Don't forget chain verification** - Always verify chain after switch request
5. **Don't skip error diagnostics** - Capture full error context for debugging

---

For questions or issues, please review the detailed integration guide and architecture diagrams.
