export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  logoURI?: string;
}

export interface TokenSecurity {
  isHoneypot: boolean;
  sellTax: number;
  buyTax: number;
  isOpenSource: boolean;
  isProxy: boolean;
  hiddenOwner: boolean;
  canTakeBackOwnership: boolean;
  ownerCanChangeBalance: boolean;
  cannotSellAll: boolean;
  isBlacklisted: boolean;
  isMintable: boolean;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'danger';
  riskCount: number;
}

export interface TokenWithPrice extends Token {
  priceUSD?: number;
  liquidityUSD?: number;
  volume24h?: number;
  priceChange24h?: number;
  valueUSD?: number;
  pairAddress?: string;
  security?: TokenSecurity;
}

export interface SwapToken {
  token: TokenWithPrice;
  amountIn: string;
  estimatedBNBOut: string;
  minBNBOut: string;
  selected: boolean;
}

export interface TransactionStatus {
  hash?: string;
  status: 'idle' | 'pending' | 'success' | 'error';
  message?: string;
}

export interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}
