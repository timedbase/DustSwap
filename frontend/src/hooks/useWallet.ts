import { useAccount, useDisconnect } from 'wagmi';
import { useEthersProvider } from './useEthersProvider';

export const useWallet = () => {
  const { address, isConnected, isConnecting, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { provider } = useEthersProvider();

  return {
    address: address || null,
    chainId: chain?.id || null,
    isConnected,
    isConnecting,
    error: null,
    provider,
    connect: async () => {
      // RainbowKit handles connection UI via ConnectButton
    },
    disconnect,
    switchToBSC: async () => chain?.id === 56,
    isMetaMaskInstalled: true,
  };
};
