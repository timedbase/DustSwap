import { useMemo } from 'react';
import { useConnectorClient } from 'wagmi';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import type { Account, Chain, Client, Transport } from 'viem';

function clientToProviderSigner(client: Client<Transport, Chain, Account>) {
  const { account, chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new BrowserProvider(transport, network);
  const signer = new JsonRpcSigner(provider, account.address);
  return { provider, signer };
}

export function useEthersProvider() {
  const { data: client } = useConnectorClient();

  return useMemo(() => {
    if (!client) return { provider: null, signer: null };
    return clientToProviderSigner(client);
  }, [client]);
}
