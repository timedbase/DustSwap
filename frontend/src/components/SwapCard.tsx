import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import type { TokenWithPrice } from '../types';
import { offchainQuoter, type SwapInstruction } from '../services/offchainQuoting';
import { batchApprovalService } from '../services/batchApproval';
import {
  DEFAULT_SLIPPAGE,
  DUSTSWAP_ROUTER_ADDRESS,
  BLOCK_EXPLORER_TX_URL,
} from '../config/constants';

interface SwapCardProps {
  tokens: TokenWithPrice[];
  provider: BrowserProvider | null;
  onSwapComplete?: () => void;
}

const DUSTSWAP_ABI = [
  'function batchSwapToBNB((address token, uint256 amount, uint256 minAmountOut, uint8 version, uint24 v3Fee)[] instructions, uint256 deadline) external returns (uint256 userAmount)',
];

export const SwapCard = ({ tokens, provider, onSwapComplete }: SwapCardProps) => {
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [customSlippage, setCustomSlippage] = useState('');
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);

  const [totalBNBExpected, setTotalBNBExpected] = useState('0');
  const [serviceFee, setServiceFee] = useState('0');
  const [userReceives, setUserReceives] = useState('0');
  const [instructions, setInstructions] = useState<SwapInstruction[]>([]);

  const [txStatus, setTxStatus] = useState<'idle' | 'approving' | 'swapping' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [approvalProgress, setApprovalProgress] = useState({ current: 0, total: 0, token: '' });

  useEffect(() => {
    const getQuotes = async () => {
      if (!provider || tokens.length === 0) {
        setTotalBNBExpected('0');
        setServiceFee('0');
        setUserReceives('0');
        setInstructions([]);
        return;
      }

      setQuoting(true);
      try {
        const result = await offchainQuoter.getBatchQuotes(tokens, slippage);
        setInstructions(result.instructions);
        setTotalBNBExpected(formatEther(result.totalBNBExpected));
        setServiceFee(formatEther(result.serviceFee));
        setUserReceives(formatEther(result.totalBNBAfterFee));
      } catch (error) {
        console.error('Error getting quotes:', error);
        setTotalBNBExpected('0');
        setServiceFee('0');
        setUserReceives('0');
      } finally {
        setQuoting(false);
      }
    };

    getQuotes();
  }, [tokens, provider, slippage]);

  const handleSlippageChange = (value: number) => {
    setSlippage(value);
    setCustomSlippage('');
  };

  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippage(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 50) {
      setSlippage(numValue);
    }
  };

  const handleSwap = async () => {
    if (!provider || tokens.length === 0 || !DUSTSWAP_ROUTER_ADDRESS) {
      setErrorMessage('Invalid configuration or no tokens selected');
      setTxStatus('error');
      return;
    }

    try {
      setLoading(true);
      setTxStatus('approving');
      setErrorMessage('');

      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      const approvalResult = await batchApprovalService.batchApprove(
        tokens,
        DUSTSWAP_ROUTER_ADDRESS,
        provider,
        userAddress,
        (current, total, token) => {
          setApprovalProgress({ current, total, token });
        }
      );

      if (!approvalResult.allApproved) {
        throw new Error(
          `Failed to approve ${approvalResult.failed.length} token(s): ${approvalResult.failed.map(f => f.symbol).join(', ')}`
        );
      }

      setTxStatus('swapping');
      setApprovalProgress({ current: 0, total: 0, token: '' });

      const dustSwapContract = new Contract(
        DUSTSWAP_ROUTER_ADDRESS,
        DUSTSWAP_ABI,
        signer
      );

      const deadline = Math.floor(Date.now() / 1000) + 1200;

      const formattedInstructions = instructions.map(inst => ({
        token: inst.token,
        amount: inst.amount,
        minAmountOut: inst.minAmountOut,
        version: inst.version,
        v3Fee: inst.v3Fee,
      }));

      const tx = await dustSwapContract.batchSwapToBNB(
        formattedInstructions,
        deadline
      );

      setTxHash(tx.hash);
      await tx.wait();

      setTxStatus('success');
      if (onSwapComplete) {
        onSwapComplete();
      }
    } catch (error: any) {
      console.error('Swap error:', error);
      setTxStatus('error');

      if (error.code === 'ACTION_REJECTED') {
        setErrorMessage('Transaction rejected by user');
      } else if (error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Swap failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetTransaction = () => {
    setTxStatus('idle');
    setTxHash('');
    setErrorMessage('');
    setApprovalProgress({ current: 0, total: 0, token: '' });
  };

  if (tokens.length === 0) {
    return (
      <div className="text-center py-6 text-[#666]">
        <p className="text-sm">No tokens selected</p>
        <p className="text-xs mt-1">Select tokens from the list to swap</p>
      </div>
    );
  }

  return (
    <div>
      {/* Slippage */}
      <div className="mb-4">
        <label className="text-xs text-[#888] mb-2 block">Slippage Tolerance</label>
        <div className="flex gap-1.5 mb-2">
          {[0.5, 1, 2, 5].map((value) => (
            <button
              key={value}
              onClick={() => handleSlippageChange(value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                slippage === value && !customSlippage
                  ? 'bg-white text-black'
                  : 'bg-[#1a1a1a] text-[#888] hover:text-white hover:bg-[#222]'
              }`}
            >
              {value}%
            </button>
          ))}
        </div>
        <input
          type="number"
          placeholder="Custom %"
          value={customSlippage}
          onChange={(e) => handleCustomSlippageChange(e.target.value)}
          className="w-full px-3 py-2 bg-black border border-[#333] rounded-lg text-white text-xs placeholder-[#555] focus:border-[#ededed] focus:outline-none transition-colors"
          min="0"
          max="50"
          step="0.1"
        />
      </div>

      {/* Quote */}
      <div className="bg-[#0a0a0a] rounded-lg p-4 mb-4 border border-[#222]">
        <div className="flex justify-between mb-2">
          <span className="text-[#666] text-xs">Swapping</span>
          <span className="text-white text-xs font-medium">{tokens.length} token(s)</span>
        </div>

        {quoting ? (
          <div className="text-center py-3">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#666] mt-2">Getting quotes...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between mb-2">
              <span className="text-[#666] text-xs">Expected BNB</span>
              <span className="text-white text-xs font-medium">{parseFloat(totalBNBExpected).toFixed(6)} BNB</span>
            </div>
            <div className="border-t border-[#222] pt-3">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-[#666]">Fee (10%)</span>
                <span className="text-[#888]">-{parseFloat(serviceFee).toFixed(6)} BNB</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-white text-sm font-medium">You Receive</span>
                <span className="text-white font-semibold text-lg">
                  {parseFloat(userReceives).toFixed(6)} BNB
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      {txStatus === 'idle' && (
        <button
          onClick={handleSwap}
          disabled={loading || quoting || tokens.length === 0 || !DUSTSWAP_ROUTER_ADDRESS}
          className="w-full py-3 bg-white text-black hover:bg-[#ededed] disabled:bg-[#222] disabled:text-[#555] disabled:cursor-not-allowed font-medium rounded-lg transition-colors"
        >
          {loading ? 'Processing...' : quoting ? 'Calculating...' : 'Swap to BNB'}
        </button>
      )}

      {txStatus === 'approving' && (
        <div className="space-y-2 py-2">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white text-sm">Approving tokens...</span>
          </div>
          {approvalProgress.total > 0 && (
            <p className="text-center text-xs text-[#666]">
              {approvalProgress.token} ({approvalProgress.current}/{approvalProgress.total})
            </p>
          )}
        </div>
      )}

      {txStatus === 'swapping' && (
        <div className="space-y-2 py-2">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white text-sm">Executing swap...</span>
          </div>
          {txHash && (
            <a href={`${BLOCK_EXPLORER_TX_URL}/${txHash}`} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-[#888] hover:text-white transition-colors">
              View transaction
            </a>
          )}
        </div>
      )}

      {txStatus === 'success' && (
        <div className="space-y-3">
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
            <p className="text-green-400 text-sm font-medium">Swap successful</p>
            <p className="text-xs text-[#888] mt-1">Received {parseFloat(userReceives).toFixed(6)} BNB</p>
            {txHash && (
              <a href={`${BLOCK_EXPLORER_TX_URL}/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#888] hover:text-white mt-1 inline-block transition-colors">
                View transaction
              </a>
            )}
          </div>
          <button onClick={resetTransaction} className="w-full py-2.5 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-lg text-sm transition-colors">
            Done
          </button>
        </div>
      )}

      {txStatus === 'error' && (
        <div className="space-y-3">
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400 text-sm font-medium">Swap failed</p>
            <p className="text-xs text-[#888] mt-1">{errorMessage}</p>
          </div>
          <button onClick={resetTransaction} className="w-full py-2.5 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-lg text-sm transition-colors">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};
