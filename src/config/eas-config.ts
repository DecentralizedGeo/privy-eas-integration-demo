// Runtime helper to load Astral EAS config and provide chain lookups.
// This file fetches the remote JSON at runtime and provides a fallback mapping for Sepolia.

type ChainRecord = {
  chain?: string
  deploymentBlock?: number
  rpcUrl?: string
  easContractAddress?: string
  schemaUID?: string
}

export const DEFAULT_SCHEMA_STRING = 'uint256 eventTimestamp,string srs,string locationType,string location,string[] recipeType,bytes[] recipePayload,string[] mediaType,string[] mediaData,string memo'

// Local chain mapping used as a fallback and also to drive the UI (header/listing)
export const NETWORK_METADATA: Record<string, ChainRecord> = {
  '42220': { chain: 'celo', rpcUrl: 'https://forno.celo.org', deploymentBlock: 26901063, easContractAddress: "0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92", schemaUID: "0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2" },
  '42161': { chain: 'arbitrum', rpcUrl: 'https://arb1.arbitrum.io/rpc', deploymentBlock: 243446573, easContractAddress: "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458", schemaUID: "0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2" },
  '11155111': { chain: 'sepolia', rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com', deploymentBlock: 6269763, easContractAddress: "0xC2679fBD37d54388Ce493F1DB75320D236e1815e", schemaUID: "0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2" },
  '8453': { chain: 'base', rpcUrl: 'https://mainnet.base.org', deploymentBlock: 25903221, easContractAddress: "0x4200000000000000000000000000000000000021", schemaUID: "0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2" },
  '10': { chain: 'optimism', rpcUrl: 'https://mainnet.optimism.io', deploymentBlock: 142210865, easContractAddress: "0x4200000000000000000000000000000000000021", schemaUID: "0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2" },
}

export function getChainNetworkDetails() {
  return NETWORK_METADATA
}
