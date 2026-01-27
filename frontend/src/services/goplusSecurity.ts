import type { TokenSecurity } from '../types';

const GOPLUS_API = 'https://api.gopluslabs.io/api/v1';
const BSC_CHAIN_ID = '56';

interface GoPlusTokenResult {
  is_open_source?: string;
  is_proxy?: string;
  is_honeypot?: string;
  sell_tax?: string;
  buy_tax?: string;
  hidden_owner?: string;
  can_take_back_ownership?: string;
  owner_change_balance?: string;
  cannot_sell_all?: string;
  is_blacklisted?: string;
  is_mintable?: string;
  is_in_dex?: string;
  [key: string]: string | undefined;
}

/**
 * GoPlus Security API service
 * Free, no API key required for basic usage.
 * Endpoint: GET /api/v1/token_security/{chain_id}?contract_addresses={addresses}
 */
class GoPlusSecurityService {
  /**
   * Get security info for a single token
   */
  async getTokenSecurity(tokenAddress: string): Promise<TokenSecurity | null> {
    const results = await this.getBatchTokenSecurity([tokenAddress]);
    return results.get(tokenAddress.toLowerCase()) ?? null;
  }

  /**
   * Get security info for multiple tokens (batch).
   * GoPlus supports comma-separated addresses in a single request.
   */
  async getBatchTokenSecurity(
    tokenAddresses: string[]
  ): Promise<Map<string, TokenSecurity>> {
    const securityMap = new Map<string, TokenSecurity>();

    if (tokenAddresses.length === 0) return securityMap;

    // GoPlus allows batching addresses comma-separated
    // Process in chunks of 50 to stay safe
    const chunkSize = 50;
    for (let i = 0; i < tokenAddresses.length; i += chunkSize) {
      const chunk = tokenAddresses.slice(i, i + chunkSize);
      const addresses = chunk.map((a) => a.toLowerCase()).join(',');

      try {
        const url = `${GOPLUS_API}/token_security/${BSC_CHAIN_ID}?contract_addresses=${addresses}`;
        console.log(`GoPlus: fetching security for ${chunk.length} tokens...`);
        const response = await fetch(url);
        const data = await response.json();

        // GoPlus returns code as 1 (number) on success
        if (Number(data.code) !== 1 || !data.result) {
          console.warn('GoPlus API error:', data.code, data.message || data);
          continue;
        }

        const resultKeys = Object.keys(data.result);
        console.log(`GoPlus: received security data for ${resultKeys.length}/${chunk.length} tokens`);

        for (const [addr, info] of Object.entries(data.result)) {
          const token = info as GoPlusTokenResult;
          const security = this.parseTokenSecurity(token);
          securityMap.set(addr.toLowerCase(), security);
        }
      } catch (error) {
        console.error('GoPlus API fetch error:', error);
      }

      // Small delay between chunks
      if (i + chunkSize < tokenAddresses.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return securityMap;
  }

  /**
   * Parse GoPlus response into our TokenSecurity type
   */
  private parseTokenSecurity(token: GoPlusTokenResult): TokenSecurity {
    const isHoneypot = token.is_honeypot === '1';
    const sellTax = parseFloat(token.sell_tax || '0');
    const buyTax = parseFloat(token.buy_tax || '0');
    const isOpenSource = token.is_open_source === '1';
    const isProxy = token.is_proxy === '1';
    const hiddenOwner = token.hidden_owner === '1';
    const canTakeBackOwnership = token.can_take_back_ownership === '1';
    const ownerCanChangeBalance = token.owner_change_balance === '1';
    const cannotSellAll = token.cannot_sell_all === '1';
    const isBlacklisted = token.is_blacklisted === '1';
    const isMintable = token.is_mintable === '1';

    // Calculate risk level based on flags
    let riskCount = 0;
    if (isHoneypot) riskCount += 3;
    if (sellTax >= 0.5) riskCount += 3; // 50%+ sell tax
    else if (sellTax >= 0.1) riskCount += 1;
    if (buyTax >= 0.5) riskCount += 2;
    else if (buyTax >= 0.1) riskCount += 1;
    if (!isOpenSource) riskCount += 1;
    if (hiddenOwner) riskCount += 2;
    if (canTakeBackOwnership) riskCount += 2;
    if (ownerCanChangeBalance) riskCount += 2;
    if (cannotSellAll) riskCount += 3;
    if (isBlacklisted) riskCount += 1;
    if (isMintable) riskCount += 1;

    let riskLevel: TokenSecurity['riskLevel'];
    if (isHoneypot || cannotSellAll || sellTax >= 0.9) {
      riskLevel = 'danger';
    } else if (riskCount >= 5) {
      riskLevel = 'high';
    } else if (riskCount >= 3) {
      riskLevel = 'medium';
    } else if (riskCount >= 1) {
      riskLevel = 'low';
    } else {
      riskLevel = 'safe';
    }

    return {
      isHoneypot,
      sellTax,
      buyTax,
      isOpenSource,
      isProxy,
      hiddenOwner,
      canTakeBackOwnership,
      ownerCanChangeBalance,
      cannotSellAll,
      isBlacklisted,
      isMintable,
      riskLevel,
      riskCount,
    };
  }
}

export const goPlusService = new GoPlusSecurityService();
