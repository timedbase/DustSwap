import { formatUnits } from 'ethers';
import type { Token } from '../types';
import { WBNB_ADDRESS, ALCHEMY_PORTFOLIO_URL } from '../config/constants';

/**
 * Fetch all ERC-20 token balances for a wallet using Alchemy Portfolio API.
 * POST https://api.g.alchemy.com/data/v1/{apiKey}/assets/tokens/by-address
 *
 * Returns tokens with non-zero balance, excluding WBNB.
 */
export class TokenScanner {
  /**
   * Fetch token balances from Alchemy Portfolio API
   */
  async getAllTokens(walletAddress: string): Promise<Token[]> {
    try {
      console.log('Fetching token balances from Alchemy Portfolio API...');

      const body = {
        addresses: [
          {
            address: walletAddress,
            networks: ['bnb-mainnet'],
          },
        ],
        withMetadata: true,
        withPrices: false,
        includeNativeTokens: false,
        includeErc20Tokens: true,
      };

      const response = await fetch(ALCHEMY_PORTFOLIO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      console.log('Alchemy response status:', response.status);

      if (!response.ok) {
        console.error('Alchemy API error:', data);
        return [];
      }

      // Response structure: { data: { tokens: [...] } }
      const tokenEntries = data?.data?.tokens ?? data?.tokens ?? [];
      const tokens: Token[] = [];

      for (const entry of tokenEntries) {
        const address = entry.tokenAddress || entry.contractAddress || entry.address;
        if (!address) continue;

        // Skip WBNB
        if (address.toLowerCase() === WBNB_ADDRESS.toLowerCase()) continue;

        const meta = entry.tokenMetadata || entry.metadata || {};
        const decimals = Number(meta.decimals ?? entry.decimals ?? 18);
        const rawBalance = entry.tokenBalance ?? entry.balance ?? '0';

        // Parse balance (hex or decimal string)
        let balanceBigInt: bigint;
        try {
          balanceBigInt = BigInt(rawBalance);
        } catch {
          continue;
        }

        if (balanceBigInt === 0n) continue;

        const symbol = meta.symbol ?? entry.symbol ?? 'UNKNOWN';
        const name = meta.name ?? entry.name ?? 'Unknown Token';

        tokens.push({
          address,
          symbol,
          name,
          decimals,
          balance: balanceBigInt.toString(),
          balanceFormatted: formatUnits(balanceBigInt, decimals),
        });
      }

      console.log(`Found ${tokens.length} tokens with non-zero balance`);
      return tokens;
    } catch (error) {
      console.error('Error fetching tokens from Alchemy:', error);
      return [];
    }
  }

  /**
   * Get BNB balance via Alchemy Portfolio API
   */
  async getBNBBalance(walletAddress: string): Promise<string> {
    try {
      const body = {
        addresses: [
          {
            address: walletAddress,
            networks: ['bnb-mainnet'],
          },
        ],
        withMetadata: false,
        withPrices: false,
        includeNativeTokens: true,
        includeErc20Tokens: false,
      };

      const response = await fetch(ALCHEMY_PORTFOLIO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) return '0';

      const nativeToken = data?.tokens?.[0];
      if (!nativeToken) return '0';

      const rawBalance = nativeToken.balance ?? nativeToken.tokenBalance ?? '0';
      const balanceBigInt = BigInt(rawBalance);
      return formatUnits(balanceBigInt, 18);
    } catch {
      return '0';
    }
  }
}

export const tokenScanner = new TokenScanner();
