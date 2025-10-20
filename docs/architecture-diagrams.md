# Privy + EAS Signer Compatibility Flow

## Quick Reference: Signer Conversion

### The Problem

```typescript
// ❌ This doesn't work with EAS SDK
const provider = await privyWallet.getEthereumProvider();
const ethersProvider = new ethers.BrowserProvider(provider);
const signer = ethersProvider.getSigner();
```

### The Solution

```typescript
// ✅ Use Wagmi hooks + conversion utilities
const wagmiSigner = useSigner(); // Uses walletClientToSigner
const eas = new EAS(easContractAddress);
await eas.connect(wagmiSigner); // Works!
```

## Signer Creation Flow

```mermaid
  flowchart LR
    A[Privy Wallet] --> B[Wagmi Context]
    B --> C[useWalletClient Hook]
    C --> D[walletClient Data]
    D --> E[walletClientToSigner]
    E --> F[Extract Transport]
    F --> G[BrowserProvider]
    G --> H[getSigner]
    H --> I[JsonRpcSigner]
    I --> J[EAS.connect]
    J --> K[✓ Compatible!]
    
    style A fill:#fff4e1
    style B fill:#e1f0ff
    style E fill:#e1f0ff
    style I fill:#d4edda
    style K fill:#d4edda
```

## Component Architecture

```mermaid
  flowchart TD
    subgraph "User Interface"
        A[App.tsx]
        B[LocationAttestationFormCard]
    end
    
    subgraph "Wagmi Layer"
        C[useWalletClient]
        D[usePublicClient]
        E[useSigner Hook]
        F[useProvider Hook]
    end
    
    subgraph "Conversion Utils"
        G[walletClientToSigner]
        H[publicClientToProvider]
    end
    
    subgraph "ethers v6"
        I[BrowserProvider]
        J[JsonRpcSigner]
        K[JsonRpcProvider]
    end
    
    subgraph "Custom Utilities"
        L[wallet-chain-helpers]
        M[wallet-address-helpers]
        N[geojson-helpers]
    end
    
    subgraph "External Services"
        O[EAS SDK]
        P[Blockchain]
    end
    
    A --> B
    B --> C
    B --> D
    C --> E
    D --> F
    E --> G
    F --> H
    G --> I
    H --> I
    I --> J
    I --> K
    B --> L
    B --> M
    B --> N
    J --> O
    K --> O
    O --> P
    L --> P
    
    style B fill:#fff4e1
    style E fill:#e1f0ff
    style F fill:#e1f0ff
    style G fill:#e1f0ff
    style H fill:#e1f0ff
    style J fill:#d4edda
    style K fill:#d4edda
    style O fill:#ffc107
```

## Attestation Submission Sequence

```mermaid
  sequenceDiagram
    participant U as User
    participant UI as Form Component
    participant W as Wagmi Hooks
    participant C as Converters
    participant E as ethers v6
    participant EAS as EAS SDK
    participant BC as Blockchain

    U->>UI: Fill attestation form
    U->>UI: Click Submit
    
    UI->>W: useSigner()
    W->>C: walletClientToSigner(client)
    C->>E: new BrowserProvider(transport)
    E->>E: getSigner(address)
    E-->>C: JsonRpcSigner
    C-->>W: signer
    W-->>UI: wagmiSigner
    
    UI->>EAS: eas.connect(wagmiSigner)
    EAS-->>UI: Connected ✓
    
    UI->>UI: Check current chain
    
    alt Wrong Chain
        UI->>BC: wallet_switchEthereumChain
        BC->>UI: chainChanged event
        UI->>UI: Wait for confirmation
    end
    
    UI->>EAS: Encode schema data
    EAS-->>UI: encodedData
    
    UI->>EAS: eas.attest(request)
    EAS->>BC: Submit transaction
    BC-->>EAS: tx hash
    EAS->>BC: tx.wait()
    BC-->>EAS: receipt
    
    UI->>UI: Extract UID from logs
    UI->>UI: Extract txHash
    
    UI-->>U: Attestation Submitted ✓
    UI-->>U: Show UID & txHash
```

## Chain Switching with Event Confirmation

```mermaid
  stateDiagram-v2
    [*] --> DetectChain: Form Submit
    DetectChain --> CheckMatch: Got chainId
    
    CheckMatch --> SwitchRequest: Chain Mismatch
    CheckMatch --> BuildData: Chain Matches
    
    SwitchRequest --> ListenEvent: Request sent
    ListenEvent --> EventFired: chainChanged event
    ListenEvent --> Timeout: 10s elapsed
    
    EventFired --> VerifyChain: Parse new chainId
    Timeout --> ForceCheck: Fallback probe
    
    VerifyChain --> BuildData: Correct chain
    VerifyChain --> Error: Wrong chain
    ForceCheck --> BuildData: Correct chain
    ForceCheck --> Error: Wrong chain
    
    BuildData --> CreateAttestation: Encode data
    CreateAttestation --> WaitReceipt: Submit tx
    WaitReceipt --> ExtractUID: Receipt received
    ExtractUID --> [*]: Success ✓
    
    Error --> [*]: Show error message
```

## Data Flow: Form Submit to Transaction Receipt

```mermaid
  flowchart TD
    Start([User Submits Form]) --> Validate{Form Valid?}
    Validate -->|No| ShowError[Show Validation Error]
    ShowError --> End1([End])
    
    Validate -->|Yes| GetSigner[Get wagmiSigner]
    GetSigner --> ChainCheck{Correct Chain?}
    
    ChainCheck -->|No| Switch[switchWalletChainWithConfirmation]
    Switch --> WaitEvent[Listen for chainChanged]
    WaitEvent --> Verify{Chain Verified?}
    Verify -->|No| Error1[Chain Switch Failed]
    Error1 --> End2([End])
    
    ChainCheck -->|Yes| BuildEncoded[Build Encoded Data]
    Verify -->|Yes| BuildEncoded
    
    BuildEncoded --> Process[processGeoJsonFeature]
    Process --> Schema[SchemaEncoder.encodeData]
    Schema --> Connect[eas.connect signer]
    Connect --> Attest[eas.attest request]
    
    Attest --> TxSent[Transaction Sent]
    TxSent --> Wait[tx.wait]
    Wait --> Receipt[Transaction Receipt]
    
    Receipt --> ExtractTx[Extract txHash]
    ExtractTx --> ExtractUID[Extract UID from logs]
    ExtractUID --> Normalize[Normalize response]
    
    Normalize --> Success([Success ✓])
    
    style Start fill:#e1f5e1
    style Success fill:#e1f5e1
    style ShowError fill:#f8d7da
    style Error1 fill:#f8d7da
    style Switch fill:#fff3cd
    style BuildEncoded fill:#e1f0ff
    style Connect fill:#d4edda
    style Attest fill:#d4edda
```

## Error Handling Strategy

```mermaid
  flowchart TD
    Error[Error Caught] --> Type{Error Type?}
    
    Type -->|User Rejected| UserMsg1[Show: User cancelled]
    Type -->|Chain Not Added| AddChain[Prompt: Add chain?]
    Type -->|Insufficient Funds| UserMsg2[Show: Need more ETH]
    Type -->|Network Error| Retry{Retry Count < 3?}
    Type -->|Unknown| Diagnostic[Build diagnostics]
    
    AddChain --> TryAdd[wallet_addEthereumChain]
    TryAdd --> Success1[Chain added ✓]
    TryAdd --> Failed1[Add failed]
    
    Retry -->|Yes| Delay[Wait 2s]
    Retry -->|No| UserMsg3[Show: Network issue]
    Delay --> RetryOp[Retry operation]
    
    Diagnostic --> Log[Log full error]
    Log --> UserMsg4[Show: Technical error]
    
    UserMsg1 --> End([End])
    Success1 --> Resume[Resume operation]
    Failed1 --> End
    UserMsg2 --> End
    UserMsg3 --> End
    RetryOp --> Outcome{Success?}
    Outcome -->|Yes| Resume
    Outcome -->|No| Error
    UserMsg4 --> End
    Resume --> End
    
    style UserMsg1 fill:#fff4e1
    style UserMsg2 fill:#fff4e1
    style UserMsg3 fill:#fff4e1
    style UserMsg4 fill:#fff4e1
    style Success1 fill:#d4edda
    style Resume fill:#d4edda
```

---

**Note**: All diagrams can be rendered in any Markdown viewer that supports Mermaid syntax (GitHub, GitLab, VS Code with Mermaid extension, etc.)
