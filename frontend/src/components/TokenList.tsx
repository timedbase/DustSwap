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
    <div className="flex items-center gap-1 py-0.5">
      <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${safe ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
        {safe ? '\u2713' : '\u2717'}
      </span>
      <span className={`text-[11px] ${safe ? 'text-[#888]' : 'text-red-300'}`}>{label}</span>
    </div>
  );
}

function SecurityPanel({ security, tokenAddress }: { security: TokenSecurity; tokenAddress: string }) {
  return (
    <div className="mt-1 bg-black/50 rounded-md border border-[#222] text-[11px] overflow-hidden">
      <div className="px-2.5 py-1.5 border-b border-[#222] flex items-center justify-between">
        <span className="font-medium text-white">Security</span>
        <a href={`${BLOCK_EXPLORER_TOKEN_URL}/${tokenAddress}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-[#555] hover:text-white font-mono transition-colors">
          {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
        </a>
      </div>
      <div className="grid grid-cols-2 divide-x divide-[#222]">
        <div className="px-2.5 py-1.5">
          <Check label="Not honeypot" safe={!security.isHoneypot} />
          <Check label="Can sell" safe={!security.cannotSellAll} />
          <Check label="No blacklist" safe={!security.isBlacklisted} />
          <Check label={`Buy tax ${(security.buyTax * 100).toFixed(0)}%`} safe={security.buyTax < 0.1} />
          <Check label={`Sell tax ${(security.sellTax * 100).toFixed(0)}%`} safe={security.sellTax < 0.1} />
        </div>
        <div className="px-2.5 py-1.5">
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
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="mt-3 text-[#666] text-xs">Scanning wallet...</p>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="text-center py-8 text-[#666]">
        <p className="text-sm">No dust tokens found</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#666]">{tokens.length} tokens</span>
        <div className="flex gap-1">
          {(['value', 'risk', 'balance'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                sortBy === key ? 'bg-white text-black' : 'bg-[#1a1a1a] text-[#666] hover:text-white'
              }`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-px max-h-[60vh] overflow-y-auto">
        {sortedTokens.map((token) => {
          const isExpanded = expandedTokens.has(token.address);
          const tradable = isTradable(token);
          const selected = selectedTokens.has(token.address);
          const isDanger = token.security?.riskLevel === 'danger' || token.security?.riskLevel === 'high';

          return (
            <div
              key={token.address}
              className={`rounded-md border transition-all ${
                isDanger
                  ? selected ? 'border-red-500/30 bg-[#111]' : 'border-transparent bg-[#0a0a0a] hover:bg-[#111]'
                  : selected ? 'border-[#333] bg-[#111]' : 'border-transparent bg-[#0a0a0a] hover:bg-[#111]'
              }`}
            >
              <div
                className={`flex items-center gap-2 px-2.5 py-2 ${tradable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                onClick={() => tradable && onToggleToken(token.address)}
              >
                {/* Checkbox */}
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                  selected ? 'border-white bg-white' : 'border-[#444]'
                }`}>
                  {selected && (
                    <svg className="w-2 h-2 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Symbol + risk dot */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="font-medium text-white text-xs">{token.symbol}</span>
                  {token.security && (
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${RISK_DOT[token.security.riskLevel] || RISK_DOT.safe}`} />
                  )}
                  {!tradable && (
                    <span className="text-[9px] text-[#444]">no liquidity</span>
                  )}
                </div>

                {/* Value */}
                <div className="text-right flex-shrink-0">
                  <span className="text-xs text-[#ededed]">${token.valueUSD?.toFixed(2) || '0.00'}</span>
                </div>

                {/* Expand */}
                {token.security && (
                  <button onClick={(e) => toggleExpand(token.address, e)} className="p-0.5 rounded hover:bg-[#222] flex-shrink-0 transition-colors">
                    <svg className={`w-3 h-3 text-[#555] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Expanded security */}
              {isExpanded && token.security && (
                <div className="px-2.5 pb-2">
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
