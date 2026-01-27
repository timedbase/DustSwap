# DustSwap

A decentralized application that automatically detects and batch swaps dust tokens (small token balances) to BNB on BNB Smart Chain.

## Features

- 🔍 **Auto-Detection**: Automatically scans your wallet for all ERC20 tokens
- 💰 **Price Data**: Real-time prices and liquidity from DexScreener API
- ⚡ **Batch Swapping**: Swap multiple dust tokens to BNB in a single transaction
- 🛡️ **Security**: Non-custodial - you maintain control of your tokens
- 🎨 **Modern UI**: Beautiful, responsive interface built with React and Tailwind CSS
- 🔧 **Custom Router**: Optimized smart contract for gas-efficient batch swaps

## Architecture

```
DustSwap/
├── contracts/          # Smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── DustSwapRouter.sol
│   │   └── interfaces/
│   ├── scripts/
│   └── test/
├── frontend/           # React application (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── config/
└── shared/             # Shared types and utilities
```

## Prerequisites

- Node.js v18+ and npm
- MetaMask or compatible Web3 wallet
- BNB for gas fees (BSC Mainnet) or testnet BNB (BSC Testnet)

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd DustSwap
```

### 2. Install dependencies

**Smart Contracts:**
```bash
cd contracts
npm install
cp .env.example .env
# Edit .env with your configuration
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your configuration
```

## Smart Contract Deployment

### 1. Configure environment

Edit `contracts/.env`:
```env
BSC_RPC_URL=https://bsc-dataseed.binance.org/
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
PRIVATE_KEY=your_private_key_here
BSCSCAN_API_KEY=your_bscscan_api_key_here
```

### 2. Compile contracts

```bash
cd contracts
npx hardhat compile
```

### 3. Run tests

```bash
npx hardhat test
```

### 4. Deploy to BSC Testnet

```bash
npx hardhat run scripts/deploy.js --network bscTestnet
```

### 5. Deploy to BSC Mainnet

```bash
npx hardhat run scripts/deploy.js --network bscMainnet
```

After deployment, copy the DustSwapRouter address and update your frontend `.env` file.

## Frontend Setup

### 1. Configure environment

Edit `frontend/.env`:
```env
VITE_BSC_RPC_URL=https://bsc-dataseed.binance.org/
VITE_DEXSCREENER_API=https://api.dexscreener.com
VITE_DUSTSWAP_ROUTER_ADDRESS=<your-deployed-contract-address>
VITE_PANCAKESWAP_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
VITE_WBNB_ADDRESS=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
```

### 2. Run development server

```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`

### 3. Build for production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Usage

1. **Connect Wallet**: Click "Connect Wallet" and approve the MetaMask connection
2. **Auto-Scan**: The app automatically scans your wallet for tokens
3. **Review Tokens**: See all your dust tokens with real-time prices and liquidity
4. **Select Tokens**: Choose which tokens you want to swap (all selected by default)
5. **Adjust Slippage**: Set your slippage tolerance (default 0.5%)
6. **Execute Swap**: Click "Swap to BNB" and confirm the transaction

## Smart Contract Details

### DustSwapRouter

**Address**: `<deployed-address>`

**Key Functions:**
- `batchSwapExactTokensForETH()`: Swap multiple tokens to BNB in one transaction
- `batchSwapExactTokensForTokens()`: Swap multiple tokens to a target token
- `getEstimatedBNBOutputs()`: Get estimated BNB output for multiple tokens
- `emergencyWithdraw()`: Emergency function to withdraw stuck tokens

**Events:**
- `BatchSwapCompleted`: Emitted when a batch swap completes
- `SingleSwapCompleted`: Emitted for each individual swap
- `EmergencyWithdraw`: Emitted on emergency withdrawals

### Integrations

- **PancakeSwap Router V2**: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- **DexScreener API**: `https://api.dexscreener.com`

## Security

- ✅ Non-custodial - Users maintain control of their tokens
- ✅ Reentrancy guards on all swap functions
- ✅ Slippage protection
- ✅ Deadline checks to prevent stuck transactions
- ✅ OpenZeppelin security libraries
- ⚠️ Always verify contracts before mainnet deployment

## Gas Optimization

- Batch swapping saves significant gas compared to individual swaps
- IR optimizer enabled for smaller bytecode
- Efficient token approval management

## Development

### Run Smart Contract Tests

```bash
cd contracts
npx hardhat test
```

### Lint Frontend Code

```bash
cd frontend
npm run lint
```

### Type Check

```bash
cd frontend
npm run type-check
```

## Troubleshooting

**"No tokens found"**
- Make sure you're connected to BSC network
- Check that your wallet has token balances
- Try refreshing the page

**"Transaction failed"**
- Increase slippage tolerance
- Check that you have enough BNB for gas
- Ensure tokens have sufficient liquidity

**"Contract not deployed"**
- Make sure you've deployed the DustSwapRouter contract
- Update the contract address in your `.env` file

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT

## Disclaimer

This software is provided "as is" without warranty. Use at your own risk. Always verify transactions and contract addresses before use. Not audited - use for educational purposes only.
