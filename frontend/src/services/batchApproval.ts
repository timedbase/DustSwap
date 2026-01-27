import { Contract, BrowserProvider, MaxUint256 } from 'ethers';
import type { TokenWithPrice } from '../types';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
];

export interface ApprovalStatus {
  token: string;
  symbol: string;
  approved: boolean;
  error?: string;
}

export interface BatchApprovalResult {
  successful: ApprovalStatus[];
  failed: ApprovalStatus[];
  allApproved: boolean;
}

/**
 * Batch approval service for approving multiple tokens
 */
export class BatchApprovalService {
  /**
   * Check if tokens need approval
   */
  async checkApprovals(
    tokens: TokenWithPrice[],
    spender: string,
    provider: BrowserProvider,
    userAddress: string
  ): Promise<Map<string, boolean>> {
    const approvalStatus = new Map<string, boolean>();

    const signer = await provider.getSigner();

    for (const token of tokens) {
      try {
        const tokenContract = new Contract(token.address, ERC20_ABI, signer);

        const allowance = await tokenContract.allowance(userAddress, spender);
        const balance = BigInt(token.balance);

        // Check if allowance is sufficient
        const isApproved = allowance >= balance;
        approvalStatus.set(token.address, isApproved);
      } catch (error) {
        console.error(`Error checking approval for ${token.symbol}:`, error);
        approvalStatus.set(token.address, false);
      }
    }

    return approvalStatus;
  }

  /**
   * Approve a single token
   */
  async approveToken(
    tokenAddress: string,
    spender: string,
    provider: BrowserProvider
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const signer = await provider.getSigner();
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);

      // Approve maximum amount
      const tx = await tokenContract.approve(spender, MaxUint256);
      await tx.wait();

      return { success: true };
    } catch (error: any) {
      console.error('Approval error:', error);
      return {
        success: false,
        error: error.message || 'Approval failed',
      };
    }
  }

  /**
   * Batch approve multiple tokens
   * Returns results for each token approval
   */
  async batchApprove(
    tokens: TokenWithPrice[],
    spender: string,
    provider: BrowserProvider,
    userAddress: string,
    onProgress?: (current: number, total: number, token: string) => void
  ): Promise<BatchApprovalResult> {
    const successful: ApprovalStatus[] = [];
    const failed: ApprovalStatus[] = [];

    // First check which tokens need approval
    const approvalStatus = await this.checkApprovals(
      tokens,
      spender,
      provider,
      userAddress
    );

    const tokensNeedingApproval = tokens.filter(
      (token) => !approvalStatus.get(token.address)
    );

    if (tokensNeedingApproval.length === 0) {
      return {
        successful: tokens.map((token) => ({
          token: token.address,
          symbol: token.symbol,
          approved: true,
        })),
        failed: [],
        allApproved: true,
      };
    }

    // Approve each token sequentially (parallel would be too many MetaMask popups)
    for (let i = 0; i < tokensNeedingApproval.length; i++) {
      const token = tokensNeedingApproval[i];

      if (onProgress) {
        onProgress(i + 1, tokensNeedingApproval.length, token.symbol);
      }

      const result = await this.approveToken(token.address, spender, provider);

      if (result.success) {
        successful.push({
          token: token.address,
          symbol: token.symbol,
          approved: true,
        });
      } else {
        failed.push({
          token: token.address,
          symbol: token.symbol,
          approved: false,
          error: result.error,
        });
      }
    }

    // Add already approved tokens to successful
    for (const token of tokens) {
      if (approvalStatus.get(token.address)) {
        successful.push({
          token: token.address,
          symbol: token.symbol,
          approved: true,
        });
      }
    }

    return {
      successful,
      failed,
      allApproved: failed.length === 0,
    };
  }

  /**
   * Get tokens that need approval
   */
  async getTokensNeedingApproval(
    tokens: TokenWithPrice[],
    spender: string,
    provider: BrowserProvider,
    userAddress: string
  ): Promise<TokenWithPrice[]> {
    const approvalStatus = await this.checkApprovals(
      tokens,
      spender,
      provider,
      userAddress
    );

    return tokens.filter((token) => !approvalStatus.get(token.address));
  }
}

export const batchApprovalService = new BatchApprovalService();
