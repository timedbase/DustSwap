import { useState } from 'react';
import type { TokenWithPrice, TokenSecurity } from '../types';
import { BLOCK_EXPLORER_TOKEN_URL } from '../config/constants';

interface TokenListProps {
  tokens: TokenWithPrice[];
  selectedTokens: Set<string>;
  onToggleToken: (tokenAddress: string) => void;
  loading?: boolean;
}

const RISK_DOT: Record<string, string> = {
  safe: 'bg-green-400',
  low: 'bg-yellow-400',
  medium: 'bg-blue-400',
  high: 'bg-red-400',
  danger: 'bg-red-400',
};

function Check({ label, safe }: { label: string; safe: boolean }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${safe ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
        {safe ? '\u2713' : '\u2717'}
      </span>
      <span className={`text-[11px] ${safe ? 'text-[#888]' : 'text-red-300'}`}>{label}</span>
    </div>
  );
}

function SecurityPanel({ security, tokenAddress }: { security: TokenSecurity; tokenAddress: string }) {
  return (
    <div className="expand-enter mt-1.5 bg-black/50 rounded-lg border border-[#222] text-[11px] overflow-hidden">
      <div className="px-3 py-2 border-b border-[#222] flex items-center justify-between">
        <span className="font-medium text-[#ededed] text-xs">Security Check</span>
        <a href={`${BLOCK_EXPLORER_TOKEN_URL}/${tokenAddress}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-[#555] hover:text-white font-mono">
          {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
        </a>
      </div>
      <div className="grid grid-cols-2 divide-x divide-[#191919]">
        <div className="px-3 py-2 space-y-0.5">
          <Check label="Not honeypot" safe={!security.isHoneypot} />
          <Check label="Can sell" safe={!security.cannotSellAll} />
          <Check label="No blacklist" safe={!security.isBlacklisted} />
          <Check label={`Buy tax ${(security.buyTax * 100).toFixed(0)}%`} safe={security.buyTax < 0.1} />
          <Check label={`Sell tax ${(security.sellTax * 100).toFixed(0)}%`} safe={security.sellTax < 0.1} />
        </div>
        <div className="px-3 py-2 space-y-0.5">
          <Check label="Verified source" safe={security.isOpenSource} />
          <Check label="No hidden owner" safe={!security.hiddenOwner} />
          <Check label="Safe ownership" safe={!security.canTakeBackOwnership} />
          <Check label="Not proxy" safe={!security.isProxy} />
          <Check label="Not mintable" safe={!security.isMintable} />
        </div>
      </div>
    </div>
  );
}

const isTradable = (t: TokenWithPrice) =>
  !!t.security && !!t.liquidityUSD && t.liquidityUSD >= 50;

export const TokenList = ({ tokens, selectedTokens, onToggleToken, loading = false }: TokenListProps) => {
  const [sortBy, setSortBy] = useState<'value' | 'balance' | 'risk'>('value');
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());

  const sortedTokens = [...tokens].sort((a, b) => {
    if (sortBy === 'value') return (b.valueUSD || 0) - (a.valueUSD || 0);
    if (sortBy === 'risk') {
      const o = { danger: 0, high: 1, medium: 2, low: 3, safe: 4 };
      return (o[a.security?.riskLevel ?? 'safe'] ?? 5) - (o[b.security?.riskLevel ?? 'safe'] ?? 5);
    }
    return parseFloat(b.balanceFormatted) - parseFloat(a.balanceFormatted);
  });

  const toggleExpand = (addr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTokens((prev) => {
      const next = new Set(prev);
      next.has(addr) ? next.delete(addr) : next.add(addr);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="mt-4 text-[#666] text-xs">Scanning wallet...</p>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="text-center py-12 text-[#666]">
        <p className="text-sm">No dust tokens found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#555]">{tokens.length} tokens</span>
        <div className="flex gap-1">
          {(['value', 'risk', 'balance'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium ${
                sortBy === key ? 'bg-white text-black' : 'bg-[#111] text-[#666] hover:text-white hover:bg-[#1a1a1a]'
              }`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
        {sortedTokens.map((token) => {
          const isExpanded = expandedTokens.has(token.address);
          const tradable = isTradable(token);
          const selected = selectedTokens.has(token.address);
          const isDanger = token.security?.riskLevel === 'danger' || token.security?.riskLevel === 'high';

          return (
            <div
              key={token.address}
              className={`rounded-lg border ${
                isDanger
                  ? selected ? 'border-red-500/25 bg-red-500/[0.03]' : 'border-transparent hover:border-[#222] hover:bg-[#0e0e0e]'
                  : selected ? 'border-[#333] bg-white/[0.02]' : 'border-transparent hover:border-[#222] hover:bg-[#0e0e0e]'
              }`}
            >
              <div
                className={`flex items-center gap-2.5 px-3 py-2.5 select-none ${tradable ? 'cursor-pointer' : 'cursor-not-allowed opacity-35'}`}
                onClick={() => tradable && onToggleToken(token.address)}
              >
                <div className={`w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center flex-shrink-0 ${
                  selected ? 'border-white bg-white' : 'border-[#333] hover:border-[#555]'
                }`}>
                  {selected && (
                    <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="font-medium text-[#ededed] text-[13px]">{token.symbol}</span>
                  {token.security && (
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${RISK_DOT[token.security.riskLevel] || RISK_DOT.safe}`} />
                  )}
                  {token.security && token.security.sellTax > 0.01 && (
                    <span className="text-[9px] text-yellow-500 font-medium ml-0.5">
                      {(token.security.sellTax * 100).toFixed(0)}%
                    </span>
                  )}
                  {!tradable && (
                    <span className="text-[9px] text-[#333] ml-0.5">no liquidity</span>
                  )}
                </div>

                <span className="text-[13px] text-[#ededed] tabular-nums flex-shrink-0">
                  ${token.valueUSD?.toFixed(2) || '0.00'}
                </span>

                {token.security && (
                  <button
                    onClick={(e) => toggleExpand(token.address, e)}
                    className="p-1 -mr-1 rounded-md hover:bg-[#1a1a1a] flex-shrink-0"
                  >
                    <svg className={`w-3.5 h-3.5 text-[#555] ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>

              {isExpanded && token.security && (
                <div className="px-3 pb-3">
                  <SecurityPanel security={token.security} tokenAddress={token.address} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
