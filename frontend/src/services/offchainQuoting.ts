import { Contract, JsonRpcProvider } from 'ethers';
import type { TokenWithPrice } from '../types';
import {
  BSC_RPC_URL,
  PANCAKESWAP_V2_ROUTER,
  PANCAKESWAP_V3_QUOTER,
  WBNB_ADDRESS,
  V3_FEE_TIERS,
} from '../config/constants';

const PANCAKE_V2_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
];

const PANCAKE_V3_QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
];

// Router version constants (matches smart contract enum)
export const RouterVersion = {
  V2: 0,
  V3: 1,
};

export type RouterVersionType = 0 | 1;

export interface SwapInstruction {
  token: string;
  amount: string;
  minAmountOut: string;
  version: RouterVersionType;
  v3Fee: number;
}

export interface QuoteResult {
  version: RouterVersionType;
  amountOut: string;
  v3Fee?: number;
}

export interface BatchQuoteResult {
  instructions: SwapInstruction[];
  totalBNBExpected: string;        // Raw quote before taxes
  totalBNBAfterTax: string;        // After token transfer taxes
  totalBNBAfterFee: string;        // After 10% service fee
  serviceFee: string;
  totalTaxDeducted: string;        // Amount lost to token taxes
  taxTokenCount: number;           // Number of tokens with >0% tax
}

/**
 * Off-chain quote service - gets best prices from V2 and V3
 */
export class OffchainQuotingService {
  private provider: JsonRpcProvider;
  private v2Router: Contract;
  private v3Quoter: Contract;

  constructor(rpcUrl: string = BSC_RPC_URL) {
    this.provider = new JsonRpcProvider(rpcUrl);
    this.v2Router = new Contract(
      PANCAKESWAP_V2_ROUTER,
      PANCAKE_V2_ROUTER_ABI,
      this.provider
    );
    this.v3Quoter = new Contract(
      PANCAKESWAP_V3_QUOTER,
      PANCAKE_V3_QUOTER_ABI,
      this.provider
    );
  }

  /**
   * Get V2 quote for token -> BNB
   */
  async getV2Quote(tokenAddress: string, amount: string): Promise<string> {
    try {
      const path = [tokenAddress, WBNB_ADDRESS];
      const amounts = await this.v2Router.getAmountsOut(amount, path);
      return amounts[1].toString();
    } catch (error) {
      console.error('V2 quote error:', error);
      return '0';
    }
  }

  /**
   * Get best V3 quote across all fee tiers
   */
  async getV3Quote(
    tokenAddress: string,
    amount: string
  ): Promise<{ amountOut: string; fee: number }> {
    let bestAmountOut = 0n;
    let bestFee = V3_FEE_TIERS.MEDIUM;

    const feeTiers = [
      V3_FEE_TIERS.LOWEST,
      V3_FEE_TIERS.LOW,
      V3_FEE_TIERS.MEDIUM,
      V3_FEE_TIERS.HIGH,
    ];

    // Try each fee tier and find the best
    for (const fee of feeTiers) {
      try {
        // Note: V3 quoter requires static call
        const amountOut = await this.v3Quoter.quoteExactInputSingle.staticCall(
          tokenAddress,
          WBNB_ADDRESS,
          fee,
          amount,
          0 // sqrtPriceLimitX96 = 0 means no limit
        );

        if (amountOut > bestAmountOut) {
          bestAmountOut = amountOut;
          bestFee = fee;
        }
      } catch (error) {
        // Pool doesn't exist for this fee tier, continue
        continue;
      }
    }

    return {
      amountOut: bestAmountOut.toString(),
      fee: bestFee,
    };
  }

  /**
   * Get best quote (V2 or V3) for a single token
   */
  async getBestQuote(
    tokenAddress: string,
    amount: string
  ): Promise<QuoteResult> {
    const [v2Quote, v3Quote] = await Promise.all([
      this.getV2Quote(tokenAddress, amount),
      this.getV3Quote(tokenAddress, amount),
    ]);

    const v2Amount = BigInt(v2Quote);
    const v3Amount = BigInt(v3Quote.amountOut);

    if (v2Amount >= v3Amount) {
      return {
        version: RouterVersion.V2 as RouterVersionType,
        amountOut: v2Quote,
      };
    } else {
      return {
        version: RouterVersion.V3 as RouterVersionType,
        amountOut: v3Quote.amountOut,
        v3Fee: v3Quote.fee,
      };
    }
  }

  /**
   * Get batch quotes for multiple tokens with slippage
   * Accounts for fee-on-transfer tokens by deducting sell tax from expected output
   */
  async getBatchQuotes(
    tokens: TokenWithPrice[],
    slippagePercent: number = 0.5
  ): Promise<BatchQuoteResult> {
    const instructions: SwapInstruction[] = [];
    let totalBNBExpected = 0n;
    let totalBNBAfterTax = 0n;
    let totalTaxDeducted = 0n;
    let taxTokenCount = 0;

    // Get quotes for all tokens in parallel
    const quotePromises = tokens.map((token) =>
      this.getBestQuote(token.address, token.balance)
    );

    const quotes = await Promise.all(quotePromises);

    // Build instructions with slippage protection
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const quote = quotes[i];

      if (quote.amountOut === '0') continue;

      const amountOut = BigInt(quote.amountOut);
      totalBNBExpected += amountOut;

      // Apply sell tax if token has fee-on-transfer
      const sellTaxPercent = token.security?.sellTax ?? 0;
      let amountAfterTax = amountOut;

      if (sellTaxPercent > 0) {
        taxTokenCount++;
        // Convert percent to basis points (e.g., 5% = 500 bps)
        const taxBps = Math.floor(sellTaxPercent * 100);
        const taxAmount = (amountOut * BigInt(taxBps)) / BigInt(10000);
        amountAfterTax = amountOut - taxAmount;
        totalTaxDeducted += taxAmount;
      }

      totalBNBAfterTax += amountAfterTax;

      // Calculate minimum amount with slippage (applied after tax)
      // For high-tax tokens, add extra slippage buffer
      const extraSlippage = sellTaxPercent > 5 ? 2 : (sellTaxPercent > 0 ? 1 : 0);
      const effectiveSlippage = slippagePercent + extraSlippage;
      const slippageBps = Math.floor(effectiveSlippage * 100);
      const minAmountOut =
        (amountAfterTax * BigInt(10000 - slippageBps)) / BigInt(10000);

      instructions.push({
        token: token.address,
        amount: token.balance,
        minAmountOut: minAmountOut.toString(),
        version: quote.version,
        v3Fee: quote.v3Fee || V3_FEE_TIERS.MEDIUM,
      });
    }

    // Calculate 10% service fee (on post-tax amount)
    const serviceFee = (totalBNBAfterTax * BigInt(10)) / BigInt(100);
    const totalBNBAfterFee = totalBNBAfterTax - serviceFee;

    return {
      instructions,
      totalBNBExpected: totalBNBExpected.toString(),
      totalBNBAfterTax: totalBNBAfterTax.toString(),
      totalBNBAfterFee: totalBNBAfterFee.toString(),
      serviceFee: serviceFee.toString(),
      totalTaxDeducted: totalTaxDeducted.toString(),
      taxTokenCount,
    };
  }

  /**
   * Calculate expected output after fee for display
   */
  calculateOutputAfterFee(totalBNB: string): {
    serviceFee: string;
    userAmount: string;
  } {
    const total = BigInt(totalBNB);
    const serviceFee = (total * BigInt(10)) / BigInt(100);
    const userAmount = total - serviceFee;

    return {
      serviceFee: serviceFee.toString(),
      userAmount: userAmount.toString(),
    };
  }
}

export const offchainQuoter = new OffchainQuotingService();
