import { useState, useEffect } from 'react';
import { WalletConnect } from './components/WalletConnect';
import { SwapCard } from './components/SwapCard';
import { TokenListModal } from './components/TokenListModal';
import { useWallet } from './hooks/useWallet';
import { useTokenBalances } from './hooks/useTokenBalances';
import type { TokenWithPrice } from './types';

const isTradable = (t: TokenWithPrice) =>
  !!t.security && !!t.liquidityUSD && t.liquidityUSD >= 50;

function App() {
  const { isConnected, address: connectedAddress, provider } = useWallet();
  const [manualAddress, setManualAddress] = useState('');
  const [viewAddress, setViewAddress] = useState<string | null>(null);
  const [showTokenList, setShowTokenList] = useState(false);

  const activeAddress = isConnected ? connectedAddress : viewAddress;
  const { dustTokens, loading, error, refetch } = useTokenBalances(activeAddress);
  const [selectedTokenAddresses, setSelectedTokenAddresses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (dustTokens.length > 0 && selectedTokenAddresses.size === 0) {
      setSelectedTokenAddresses(new Set(dustTokens.filter(isTradable).map((t) => t.address)));
    }
  }, [dustTokens]);

  useEffect(() => {
    setSelectedTokenAddresses(new Set());
  }, [activeAddress]);

  const handleToggleToken = (tokenAddress: string) => {
    const token = dustTokens.find((t) => t.address === tokenAddress);
    if (token && !isTradable(token)) return;
    setSelectedTokenAddresses((prev) => {
      const s = new Set(prev);
      s.has(tokenAddress) ? s.delete(tokenAddress) : s.add(tokenAddress);
      return s;
    });
  };

  const handleSelectAll = () => setSelectedTokenAddresses(new Set(dustTokens.filter(isTradable).map((t) => t.address)));
  const handleDeselectAll = () => setSelectedTokenAddresses(new Set());

  const handleSwapComplete = () => {
    setTimeout(() => { refetch(); setSelectedTokenAddresses(new Set()); }, 3000);
  };

  const handleViewAddress = () => {
    if (manualAddress.startsWith('0x') && manualAddress.length === 42) setViewAddress(manualAddress);
  };

  const handleClearViewAddress = () => {
    setViewAddress(null);
    setManualAddress('');
    setSelectedTokenAddresses(new Set());
  };

  const selectedTokens: TokenWithPrice[] = dustTokens.filter((t) => selectedTokenAddresses.has(t.address));
  const isValidAddress = manualAddress.startsWith('0x') && manualAddress.length === 42;
  const tradableCount = dustTokens.filter(isTradable).length;

  return (
    <div className="min-h-screen bg-black">
      {/* Nav */}
      <nav className="border-b border-[#222]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[15px] font-semibold text-white tracking-tight">DustSwap</span>
            <span className="text-[11px] text-[#666] font-mono">BSC</span>
          </div>
          <WalletConnect />
        </div>
      </nav>

      <main className="flex flex-col items-center px-4 py-10 sm:py-16 fade-in">
        {/* Address input */}
        {!isConnected && !viewAddress && (
          <div className="w-full max-w-[480px] mb-6">
            <div className="bg-[#111] border border-[#222] rounded-xl p-4">
              <p className="text-[#888] text-sm mb-3">Enter a wallet address to view</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="0x..."
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleViewAddress()}
                  className="flex-1 px-3 py-2 bg-black border border-[#333] rounded-lg text-white text-sm placeholder-[#555] focus:border-[#ededed] focus:outline-none transition-colors min-w-0"
                />
                <button
                  onClick={handleViewAddress}
                  disabled={!isValidAddress}
                  className="px-4 py-2 bg-white text-black hover:bg-[#ededed] disabled:bg-[#222] disabled:text-[#555] disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Viewing address bar */}
        {viewAddress && !isConnected && (
          <div className="flex items-center gap-2 mb-6 bg-[#111] border border-[#222] rounded-lg px-3 py-2">
            <span className="text-[#666] text-xs">Viewing</span>
            <span className="text-white font-mono text-xs">{viewAddress.slice(0, 6)}...{viewAddress.slice(-4)}</span>
            <button onClick={handleClearViewAddress} className="text-[#666] hover:text-white text-xs ml-1">&times;</button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="w-full max-w-[480px] mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Main card */}
        <div className="w-full max-w-[480px]">
          {activeAddress ? (
            <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
              {/* Card header */}
              <div className="px-5 pt-5 pb-0 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Swap</h2>
                <span className="text-xs text-[#666]">Dust &rarr; BNB</span>
              </div>

              {/* Token selector */}
              <div className="px-5 pt-4">
                <button
                  onClick={() => setShowTokenList(true)}
                  className="w-full px-4 py-3 bg-[#0a0a0a] hover:bg-[#1a1a1a] border border-[#222] hover:border-[#444] rounded-lg text-left transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[#888] text-sm">
                      {loading ? 'Scanning...' : `${dustTokens.length} tokens found`}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">
                        {selectedTokenAddresses.size} selected
                      </span>
                      <svg className="w-4 h-4 text-[#555] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  {tradableCount > 0 && (
                    <div className="mt-1 text-xs text-[#555]">
                      {tradableCount} tradable &middot; ~${selectedTokens.reduce((s, t) => s + (t.valueUSD || 0), 0).toFixed(2)}
                    </div>
                  )}
                </button>
              </div>

              {/* Swap section */}
              <div className="p-5">
                {isConnected ? (
                  <SwapCard tokens={selectedTokens} provider={provider} onSwapComplete={handleSwapComplete} />
                ) : (
                  <div>
                    {/* Estimate */}
                    <div className="mb-4 p-4 bg-[#0a0a0a] rounded-lg border border-[#222]">
                      <div className="text-xs text-[#666] mb-1">Estimated output</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold text-white">
                          ~{(selectedTokens.reduce((s, t) => s + (t.valueUSD || 0), 0) * 0.9 / 600).toFixed(4)}
                        </span>
                        <span className="text-[#888] text-sm">BNB</span>
                      </div>
                      <div className="mt-1 text-xs text-[#555]">
                        ~${(selectedTokens.reduce((s, t) => s + (t.valueUSD || 0), 0) * 0.9).toFixed(2)} after fee
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <div className="w-full py-3 bg-white/5 border border-[#333] rounded-lg text-center">
                        <p className="text-white text-sm font-medium">Connect wallet to swap</p>
                      </div>
                      <WalletConnect />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="bg-[#111] border border-[#222] rounded-xl p-8 text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Clean up wallet dust</h2>
              <p className="text-[#888] text-sm mb-8">
                Swap small token balances into BNB in one transaction.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { title: 'Detect', desc: 'Auto-scan tokens' },
                  { title: 'Analyze', desc: 'Security checks' },
                  { title: 'Swap', desc: 'Batch to BNB' },
                ].map((f) => (
                  <div key={f.title} className="bg-[#0a0a0a] border border-[#222] rounded-lg p-3">
                    <h3 className="text-white text-sm font-medium">{f.title}</h3>
                    <p className="text-[11px] text-[#666] mt-0.5">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-[#444] text-[11px]">
          DustSwap
        </div>
      </main>

      <TokenListModal
        isOpen={showTokenList}
        onClose={() => setShowTokenList(false)}
        tokens={dustTokens}
        selectedTokens={selectedTokenAddresses}
        onToggleToken={handleToggleToken}
        loading={loading}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onRefresh={refetch}
      />
    </div>
  );
}

export default App;
