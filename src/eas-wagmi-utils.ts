import { JsonRpcProvider, FallbackProvider, BrowserProvider } from "ethers";
import { useEffect, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";

export function publicClientToProvider(publicClient: any) {
  const { chain, transport } = publicClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address
  };
  if (transport.type === "fallback")
    return new FallbackProvider(
      transport.transports.map(({ value }: any) => new JsonRpcProvider(value?.url, network))
    );
  return new JsonRpcProvider(transport.url, network);
}

export async function walletClientToSigner(walletClient: any) {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new BrowserProvider(transport as any, network);
  // BrowserProvider.getSigner returns a Promise<JsonRpcSigner> in ethers v6
  const signer = await provider.getSigner(account.address);

  return signer;
}


export function useSigner() {
  const { data: walletClient } = useWalletClient();
  const [signer, setSigner] = useState<any | undefined>(undefined);
  useEffect(() => {
    async function getSigner() {
      if (!walletClient) return;

      const tmpSigner = await walletClientToSigner(walletClient);

      setSigner(tmpSigner);
    }

    getSigner();

  }, [walletClient]);
  return signer;
}

export function useProvider() {
  const publicClient = usePublicClient();
  const [provider, setProvider] = useState<FallbackProvider | JsonRpcProvider | undefined>(undefined);
  useEffect(() => {
    async function getSigner() {
      if (!publicClient) return;

      const tmpProvider = publicClientToProvider(publicClient);

      setProvider(tmpProvider);
    }

    getSigner();

  }, [publicClient]);
  return provider;
}