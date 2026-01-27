import { useState, useEffect } from 'react';
import { JsonRpcProvider, isAddress } from 'ethers';

const ETH_RPC = 'https://eth.llamarpc.com';

let ethProvider: JsonRpcProvider | null = null;
function getEthProvider() {
  if (!ethProvider) ethProvider = new JsonRpcProvider(ETH_RPC);
  return ethProvider;
}

function looksLikeEns(input: string): boolean {
  return /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(input.trim());
}

export function useEnsResolve(input: string) {
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [ensName, setEnsName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = input.trim();

  // Direct address check
  const isDirectAddress = isAddress(trimmed);

  useEffect(() => {
    setResolvedAddress(null);
    setEnsName(null);
    setError(null);

    if (!trimmed) return;

    if (isDirectAddress) {
      setResolvedAddress(trimmed);
      return;
    }

    if (!looksLikeEns(trimmed)) return;

    let cancelled = false;
    setResolving(true);

    getEthProvider()
      .resolveName(trimmed)
      .then((addr) => {
        if (cancelled) return;
        if (addr) {
          setResolvedAddress(addr);
          setEnsName(trimmed);
        } else {
          setError('ENS name not found');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to resolve ENS');
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });

    return () => { cancelled = true; };
  }, [trimmed, isDirectAddress]);

  return {
    resolvedAddress,
    ensName,
    resolving,
    error,
    isValid: !!resolvedAddress,
    isEns: !!ensName,
  };
}
