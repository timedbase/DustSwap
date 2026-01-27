import { Contract, BrowserProvider, parseUnits, formatUnits } from 'ethers';
import type { TokenWithPrice } from '../types';
import {
  DUSTSWAP_ROUTER_ADDRESS,
  PANCAKESWAP_ROUTER,
  WBNB_ADDRESS,
  DEFAULT_SLIPPAGE,
  DEFAULT_DEADLINE,
} from '../config/constants';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const PANCAKE_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
];

const DUSTSWAP_ROUTER_ABI = [
  'function batchSwapExactTokensForETH(address[] tokens, uint256[] amounts, uint256[] minAmountsOut, uint256 deadline) returns (uint256)',
  'function getEstimatedBNBOutputs(address[] tokens, uint256[] amounts) view returns (uint256[] memory)',
];

export class SwapBuilder {
  private provider: BrowserProvider;

  constructor(provider: BrowserProvider) {
    this.provider = provider;
  }

  /**
   * Check if token is approved for DustSwap router
   */
  async checkApproval(
    tokenAddress: string,
    ownerAddress: string,
    amount: string
  ): Promise<boolean> {
    try {
      const tokenContract = new Contract(
        tokenAddress,
        ERC20_ABI,
        this.provider
      );

      const allowance = await tokenContract.allowance(
        ownerAddress,
        DUSTSWAP_ROUTER_ADDRESS
      );

      return allowance >= BigInt(amount);
    } catch (error) {
      console.error('Error checking approval:', error);
      return false;
    }
  }

  /**
   * Approve token for DustSwap router
   */
  async approveToken(
    tokenAddress: string,
    amount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const signer = await this.provider.getSigner();
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);

      const tx = await tokenContract.approve(
        DUSTSWAP_ROUTER_ADDRESS,
        amount
      );

      console.log(`Approval tx sent: ${tx.hash}`);
      await tx.wait();

      return { success: true, txHash: tx.hash };
    } catch (error: any) {
      console.error('Error approving token:', error);
      return {
        success: false,
        error: error.message || 'Failed to approve token',
      };
    }
  }

  /**
   * Get estimated BNB output for a token swap
   */
  async getEstimatedBNBOutput(
    tokenAddress: string,
    amountIn: string,
    decimals: number
  ): Promise<string | null> {
    try {
      const pancakeRouter = new Contract(
        PANCAKESWAP_ROUTER,
        PANCAKE_ROUTER_ABI,
        this.provider
      );

      const path = [tokenAddress, WBNB_ADDRESS];
      const amounts = await pancakeRouter.getAmountsOut(
        parseUnits(amountIn, decimals),
        path
      );

      return formatUnits(amounts[1], 18); // BNB has 18 decimals
    } catch (error) {
      console.error('Error getting estimated output:', error);
      return null;
    }
  }

  /**
   * Get estimated BNB outputs for multiple tokens
   */
  async getBatchEstimatedOutputs(
    tokens: TokenWithPrice[]
  ): Promise<Map<string, string>> {
    const outputMap = new Map<string, string>();

    try {
      if (!DUSTSWAP_ROUTER_ADDRESS) {
        console.error('DustSwap router address not configured');
        return outputMap;
      }

      const dustSwapRouter = new Contract(
        DUSTSWAP_ROUTER_ADDRESS,
        DUSTSWAP_ROUTER_ABI,
        this.provider
      );

      const addresses = tokens.map((t) => t.address);
      const amounts = tokens.map((t) =>
        parseUnits(t.balanceFormatted, t.decimals)
      );

      const outputs = await dustSwapRouter.getEstimatedBNBOutputs(
        addresses,
        amounts
      );

      for (let i = 0; i < tokens.length; i++) {
        outputMap.set(
          tokens[i].address.toLowerCase(),
          formatUnits(outputs[i], 18)
        );
      }
    } catch (error) {
      console.error('Error getting batch estimated outputs:', error);
    }

    return outputMap;
  }

  /**
   * Calculate minimum output with slippage
   */
  calculateMinOutput(estimatedOutput: string, slippage: number = DEFAULT_SLIPPAGE): string {
    const output = parseFloat(estimatedOutput);
    const minOutput = output * (1 - slippage / 100);
    return minOutput.toFixed(18);
  }

  /**
   * Execute batch swap
   */
  async executeBatchSwap(
    tokens: TokenWithPrice[],
    slippage: number = DEFAULT_SLIPPAGE,
    deadlineMinutes: number = DEFAULT_DEADLINE
  ): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
    totalBNBReceived?: string;
  }> {
    try {
      if (!DUSTSWAP_ROUTER_ADDRESS) {
        return {
          success: false,
          error: 'DustSwap router address not configured. Please deploy the contract first.',
        };
      }

      // Step 1: Check and approve tokens
      console.log('Checking token approvals...');
      const signer = await this.provider.getSigner();
      const signerAddress = await signer.getAddress();

      for (const token of tokens) {
        const amount = parseUnits(token.balanceFormatted, token.decimals).toString();
        const isApproved = await this.checkApproval(
          token.address,
          signerAddress,
          amount
        );

        if (!isApproved) {
          console.log(`Approving ${token.symbol}...`);
          const approvalResult = await this.approveToken(token.address, amount);

          if (!approvalResult.success) {
            return {
              success: false,
              error: `Failed to approve ${token.symbol}: ${approvalResult.error}`,
            };
          }
        }
      }

      // Step 2: Get estimated outputs
      console.log('Calculating estimated outputs...');
      const addresses = tokens.map((t) => t.address);
      const amounts = tokens.map((t) =>
        parseUnits(t.balanceFormatted, t.decimals)
      );

      const dustSwapRouter = new Contract(
        DUSTSWAP_ROUTER_ADDRESS,
        DUSTSWAP_ROUTER_ABI,
        signer
      );

      const estimatedOutputs = await dustSwapRouter.getEstimatedBNBOutputs(
        addresses,
        amounts
      );

      // Calculate minimum outputs with slippage
      const minAmountsOut = estimatedOutputs.map((output: bigint) => {
        const outputStr = formatUnits(output, 18);
        const minOutput = this.calculateMinOutput(outputStr, slippage);
        return parseUnits(minOutput, 18);
      });

      // Step 3: Execute batch swap
      console.log('Executing batch swap...');
      const deadline =
        Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

      const tx = await dustSwapRouter.batchSwapExactTokensForETH(
        addresses,
        amounts,
        minAmountsOut,
        deadline
      );

      console.log(`Swap tx sent: ${tx.hash}`);
      const receipt = await tx.wait();

      // Try to parse the event to get total BNB received
      let totalBNBReceived: string | undefined;
      try {
        const event = receipt.logs
          .map((log: any) => {
            try {
              return dustSwapRouter.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((e: any) => e && e.name === 'BatchSwapCompleted');

        if (event) {
          totalBNBReceived = formatUnits(event.args.totalBNBReceived, 18);
        }
      } catch (error) {
        console.error('Error parsing event:', error);
      }

      return {
        success: true,
        txHash: tx.hash,
        totalBNBReceived,
      };
    } catch (error: any) {
      console.error('Error executing batch swap:', error);
      return {
        success: false,
        error: error.message || 'Failed to execute batch swap',
      };
    }
  }
}
