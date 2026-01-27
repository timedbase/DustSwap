import { useState, useEffect, useCallback } from 'react';
import type { TokenWithPrice } from '../types';
import { tokenScanner } from '../services/tokenScanner';
import { dexScreenerService } from '../services/dexscreener';
import { goPlusService } from '../services/goplusSecurity';
import { DUST_THRESHOLD_USD } from '../config/constants';

export const useTokenBalances = (walletAddress: string | null) => {
  const [tokens, setTokens] = useState<TokenWithPrice[]>([]);
  const [dustTokens, setDustTokens] = useState<TokenWithPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenBalances = useCallback(async () => {
    if (!walletAddress) {
      setTokens([]);
      setDustTokens([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Fetch token balances via Alchemy Portfolio API
      console.log('Scanning wallet for tokens...');
      const scannedTokens = await tokenScanner.getAllTokens(walletAddress);

      console.log(`Found ${scannedTokens.length} tokens`);

      if (scannedTokens.length === 0) {
        setTokens([]);
        setDustTokens([]);
        setLoading(false);
        return;
      }

      const tokenAddresses = scannedTokens.map((t) => t.address);

      // Step 2: Fetch price data from DexScreener
      console.log('Fetching price data from DexScreener...');
      const priceData = await dexScreenerService.getBatchTokenInfo(tokenAddresses);
      console.log(`DexScreener data fetched for ${priceData.size} tokens`);

      // Step 3: Only send tokens with >= $50 liquidity to GoPlus
      const liquidTokenAddresses = tokenAddresses.filter((addr) => {
        const info = priceData.get(addr.toLowerCase());
        return info?.liquidityUSD != null && info.liquidityUSD >= 50;
      });
      console.log(`${liquidTokenAddresses.length} tokens have >= $50 liquidity, fetching GoPlus security...`);

      const securityData = new Map<string, import('../types').TokenSecurity>();
      if (liquidTokenAddresses.length > 0) {
        const results = await Promise.all(
          liquidTokenAddresses.map((addr) =>
            goPlusService.getTokenSecurity(addr).then(
              (sec) => ({ addr: addr.toLowerCase(), sec }),
              () => ({ addr: addr.toLowerCase(), sec: null })
            )
          )
        );
        for (const { addr, sec } of results) {
          if (sec) securityData.set(addr, sec);
        }
        console.log(`Security data fetched for ${securityData.size}/${liquidTokenAddresses.length} tokens`);
      }

      // Step 4: Combine token data with price + security info
      const tokensWithPrice: TokenWithPrice[] = scannedTokens.map((token) => {
        const addrLower = token.address.toLowerCase();
        const info = priceData.get(addrLower);
        const security = securityData.get(addrLower);
        const priceUSD = info?.priceUSD || 0;
        const balanceNum = parseFloat(token.balanceFormatted);
        const valueUSD = priceUSD * balanceNum;

        return {
          ...token,
          priceUSD: info?.priceUSD || undefined,
          liquidityUSD: info?.liquidityUSD || undefined,
          volume24h: info?.volume24h || undefined,
          priceChange24h: info?.priceChange24h || undefined,
          valueUSD,
          pairAddress: info?.pairAddress || undefined,
          security,
        };
      });

      // Sort by value (descending)
      const sortedTokens = tokensWithPrice.sort((a, b) => {
        const valueA = a.valueUSD || 0;
        const valueB = b.valueUSD || 0;
        return valueB - valueA;
      });

      // Dust tokens: no price data OR value < threshold
      const dust = sortedTokens.filter(
        (t) => t.valueUSD === undefined || t.valueUSD === 0 || t.valueUSD < DUST_THRESHOLD_USD
      );

      setTokens(sortedTokens);
      setDustTokens(dust);
      console.log(`Found ${dust.length} dust tokens (< $${DUST_THRESHOLD_USD})`);
    } catch (err: any) {
      console.error('Error fetching token balances:', err);
      setError(err.message || 'Failed to fetch token balances');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  // Fetch on mount and when wallet changes
  useEffect(() => {
    fetchTokenBalances();
  }, [fetchTokenBalances]);

  return {
    tokens,
    dustTokens,
    loading,
    error,
    refetch: fetchTokenBalances,
  };
};
