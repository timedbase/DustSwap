export const BSC_CHAIN_ID = 56;
export const BSC_TESTNET_CHAIN_ID = 97;

export const BSC_RPC_URL = import.meta.env.VITE_BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';

// Multiple BSC RPC endpoints for load balancing and failover
export const BSC_RPC_URLS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.binance.org/',
  'https://bsc-dataseed2.binance.org/',
  'https://bsc-dataseed3.binance.org/',
  'https://bsc-dataseed4.binance.org/',
  'https://bsc-dataseed1.defibit.io/',
  'https://bsc-dataseed2.defibit.io/',
  'https://bsc-dataseed3.defibit.io/',
  'https://bsc-dataseed4.defibit.io/',
  'https://bsc-dataseed1.ninicoin.io/',
  'https://bsc-dataseed2.ninicoin.io/',
  'https://bsc-dataseed3.ninicoin.io/',
  'https://bsc-dataseed4.ninicoin.io/',
  'https://bsc.publicnode.com',
];
export const DEXSCREENER_API = import.meta.env.VITE_DEXSCREENER_API || 'https://api.dexscreener.com';
export const DUSTSWAP_ROUTER_ADDRESS = import.meta.env.VITE_DUSTSWAP_ROUTER_ADDRESS || '';

// PancakeSwap V2
export const PANCAKESWAP_V2_ROUTER = import.meta.env.VITE_PANCAKESWAP_V2_ROUTER || '0x10ED43C718714eb63d5aA57B78B54704E256024E';

// PancakeSwap V3
export const PANCAKESWAP_V3_ROUTER = import.meta.env.VITE_PANCAKESWAP_V3_ROUTER || '0x1b81D678ffb9C0263b24A97847620C99d213eB14';
export const PANCAKESWAP_V3_QUOTER = import.meta.env.VITE_PANCAKESWAP_V3_QUOTER || '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';

// Legacy support
export const PANCAKESWAP_ROUTER = PANCAKESWAP_V2_ROUTER;

export const WBNB_ADDRESS = import.meta.env.VITE_WBNB_ADDRESS || '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// V3 Pool Fees
export const V3_FEE_TIERS = {
  LOWEST: 100,    // 0.01%
  LOW: 500,       // 0.05%
  MEDIUM: 2500,   // 0.25%
  HIGH: 10000,    // 1%
};

export const DUST_THRESHOLD_USD = 10; // Tokens worth less than $10 are considered "dust"
export const DEFAULT_SLIPPAGE = 0.5; // 0.5%
export const DEFAULT_DEADLINE = 20; // 20 minutes

// Alchemy Portfolio API
export const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || '';
export const ALCHEMY_PORTFOLIO_URL = `https://api.g.alchemy.com/data/v1/${ALCHEMY_API_KEY}/assets/tokens/by-address`;

export const BLOCK_EXPLORER_URL = 'https://bscscan.com';
export const BLOCK_EXPLORER_TX_URL = `${BLOCK_EXPLORER_URL}/tx`;
export const BLOCK_EXPLORER_ADDRESS_URL = `${BLOCK_EXPLORER_URL}/address`;
export const BLOCK_EXPLORER_TOKEN_URL = `${BLOCK_EXPLORER_URL}/token`;
