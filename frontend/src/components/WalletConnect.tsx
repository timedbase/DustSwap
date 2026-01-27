import { ConnectButton } from '@rainbow-me/rainbowkit';

export const WalletConnect = () => {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: { opacity: 0, pointerEvents: 'none' as const, userSelect: 'none' as const },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="px-5 py-2.5 bg-[#FF007A] hover:bg-[#FF1A8C] text-white rounded-xl text-sm font-semibold transition-all"
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className="px-3 py-2 bg-[#191B1F] hover:bg-[#212429] border border-[#2C2F36] rounded-xl text-white text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        alt={chain.name ?? 'Chain'}
                        src={chain.iconUrl}
                        className="w-4 h-4 rounded-full"
                      />
                    )}
                    {chain.name}
                  </button>
                  <button
                    onClick={openAccountModal}
                    className="px-4 py-2 bg-[#191B1F] hover:bg-[#212429] border border-[#2C2F36] rounded-xl text-white text-sm font-medium transition-all flex items-center gap-2"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    {account.displayName}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
