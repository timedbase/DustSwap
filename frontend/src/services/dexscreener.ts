import type { DexScreenerTokenResponse, DexScreenerPair } from '../types/dexscreener';
import { DEXSCREENER_API } from '../config/constants';

export class DexScreenerService {
  private baseUrl: string;
  private cache: Map<string, { data: DexScreenerTokenResponse; timestamp: number }>;
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  constructor(baseUrl: string = DEXSCREENER_API) {
    this.baseUrl = baseUrl;
    this.cache = new Map();
  }

  /**
   * Get token data from DexScreener
   */
  async getTokenData(tokenAddress: string): Promise<DexScreenerTokenResponse | null> {
    try {
      // Check cache first
      const cached = this.cache.get(tokenAddress.toLowerCase());
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }

      const response = await fetch(
        `${this.baseUrl}/latest/dex/tokens/${tokenAddress}`
      );

      if (!response.ok) {
        console.error(`DexScreener API error: ${response.status}`);
        return null;
      }

      const data: DexScreenerTokenResponse = await response.json();

      // Cache the result
      this.cache.set(tokenAddress.toLowerCase(), {
        data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      console.error('Error fetching from DexScreener:', error);
      return null;
    }
  }

  /**
   * Get the best pair for a token (highest liquidity)
   */
  async getBestPair(tokenAddress: string): Promise<DexScreenerPair | null> {
    const data = await this.getTokenData(tokenAddress);

    if (!data || !data.pairs || data.pairs.length === 0) {
      return null;
    }

    // Filter BSC pairs only
    const bscPairs = data.pairs.filter(
      (pair) => pair.chainId === 'bsc' || pair.chainId === 'bnb'
    );

    if (bscPairs.length === 0) {
      return null;
    }

    // Sort by liquidity USD (descending)
    const sortedPairs = bscPairs.sort((a, b) => {
      const liquidityA = a.liquidity?.usd || 0;
      const liquidityB = b.liquidity?.usd || 0;
      return liquidityB - liquidityA;
    });

    return sortedPairs[0];
  }

  /**
   * Get token price in USD
   */
  async getTokenPrice(tokenAddress: string): Promise<number | null> {
    const pair = await this.getBestPair(tokenAddress);
    if (!pair || !pair.priceUsd) {
      return null;
    }
    return parseFloat(pair.priceUsd);
  }

  /**
   * Get multiple token prices in batch
   */
  async getMultipleTokenPrices(
    tokenAddresses: string[]
  ): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();

    const results = await Promise.allSettled(
      tokenAddresses.map(async (address) => {
        const price = await this.getTokenPrice(address);
        return { address: address.toLowerCase(), price };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.price !== null) {
        priceMap.set(result.value.address, result.value.price);
      }
    }

    return priceMap;
  }

  /**
   * Get token liquidity in USD
   */
  async getTokenLiquidity(tokenAddress: string): Promise<number | null> {
    const pair = await this.getBestPair(tokenAddress);
    if (!pair || !pair.liquidity?.usd) {
      return null;
    }
    return pair.liquidity.usd;
  }

  /**
   * Get comprehensive token info
   */
  async getTokenInfo(tokenAddress: string) {
    const pair = await this.getBestPair(tokenAddress);

    if (!pair) {
      return {
        priceUSD: null,
        liquidityUSD: null,
        volume24h: null,
        priceChange24h: null,
        pairAddress: null,
      };
    }

    return {
      priceUSD: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
      liquidityUSD: pair.liquidity?.usd || null,
      volume24h: pair.volume?.h24 || null,
      priceChange24h: pair.priceChange?.h24 || null,
      pairAddress: pair.pairAddress || null,
    };
  }

  /**
   * Get token info for multiple tokens
   */
  async getBatchTokenInfo(tokenAddresses: string[]) {
    const results = await Promise.allSettled(
      tokenAddresses.map(async (address) => {
        const info = await this.getTokenInfo(address);
        return { address: address.toLowerCase(), info };
      })
    );

    const infoMap = new Map<
      string,
      {
        priceUSD: number | null;
        liquidityUSD: number | null;
        volume24h: number | null;
        priceChange24h: number | null;
        pairAddress: string | null;
      }
    >();

    for (const result of results) {
      if (result.status === 'fulfilled') {
        infoMap.set(result.value.address, result.value.info);
      }
    }

    return infoMap;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export const dexScreenerService = new DexScreenerService();
