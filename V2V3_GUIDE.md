# DustSwap V2/V3 Support Guide

## Overview

DustSwap now supports **both PancakeSwap V2 and V3**, providing better prices and more flexibility for swapping dust tokens.

## What's New

### DustSwapRouterV2V3 Contract

The new `DustSwapRouterV2V3` contract offers:

✅ **Dual Router Support** - Routes through both V2 and V3
✅ **Automatic Route Selection** - Chooses the best price automatically
✅ **Manual Control** - Specify which version to use per token
✅ **Multiple Fee Tiers** - V3 supports 0.01%, 0.05%, 0.25%, 1% pools
✅ **Price Comparison** - Real-time quotes from both versions

## How It Works

### Automatic Mode (Recommended)

```solidity
batchSwapAuto(
    address[] tokens,      // Tokens to swap
    uint256[] amounts,     // Amounts per token
    uint256[] minOuts,     // Minimum BNB per token
    uint256 deadline       // Transaction deadline
)
```

**Process:**
1. For each token, contract checks quotes from V2 and all V3 fee tiers
2. Selects the route with the best output
3. Executes swap on the selected router
4. Returns all BNB to user

### Manual Mode (Advanced)

```solidity
struct SwapConfig {
    address token;
    uint256 amount;
    uint256 minAmountOut;
    RouterVersion version;  // V2, V3, or AUTO
    uint24 v3Fee;          // Only for V3 (100, 500, 2500, 10000)
}

batchSwapManual(SwapConfig[] configs, uint256 deadline)
```

**Use Cases:**
- Force V2 for tokens with better V2 liquidity
- Force V3 for tokens with better V3 pools
- Mix V2 and V3 in a single batch

## PancakeSwap Version Differences

### V2 (Uniswap V2 Fork)
- **Fee**: Fixed 0.25% per swap
- **Liquidity**: Deeper liquidity for most established tokens
- **Simplicity**: Single swap path
- **Gas**: Lower gas cost per swap

### V3 (Uniswap V3 Fork)
- **Fees**: Multiple tiers (0.01%, 0.05%, 0.25%, 1%)
- **Capital Efficiency**: Concentrated liquidity
- **Better for**:
  - Stablecoins (use 0.01% pools)
  - Low volatility pairs
  - Newer tokens with V3-only liquidity
- **Gas**: Slightly higher per swap

## BSC Contract Addresses

### Mainnet (Chain ID: 56)

**PancakeSwap V2:**
- Router: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- Factory: `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73`

**PancakeSwap V3:**
- SmartRouter: `0x1b81D678ffb9C0263b24A97847620C99d213eB14`
- Quoter: `0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997`
- Factory: `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865`

**Other:**
- WBNB: `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`

### Testnet (Chain ID: 97)

**PancakeSwap V2:**
- Router: `0xD99D1c33F9fC3444f8101754aBC46c52416550D1`

**PancakeSwap V3:**
- Check PancakeSwap docs for latest testnet addresses

## Deployment

### Deploy V2/V3 Router

```bash
cd contracts

# Compile the new contract
npx hardhat compile

# Deploy to BSC Testnet
npx hardhat run scripts/deployV2V3.js --network bscTestnet

# Deploy to BSC Mainnet
npx hardhat run scripts/deployV2V3.js --network bscMainnet
```

### Update Frontend Configuration

Add to `frontend/.env`:

```env
# V2/V3 Router (new deployment)
VITE_DUSTSWAP_ROUTER_ADDRESS=<deployed_v2v3_router_address>

# PancakeSwap V2
VITE_PANCAKESWAP_V2_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E

# PancakeSwap V3
VITE_PANCAKESWAP_V3_ROUTER=0x1b81D678ffb9C0263b24A97847620C99d213eB14
VITE_PANCAKESWAP_V3_QUOTER=0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997
```

## Usage Examples

### Example 1: Automatic Best Price

```javascript
// Frontend code
const tokens = ['0xTokenA...', '0xTokenB...', '0xTokenC...'];
const amounts = ['1000000000000000000', '2000000000000000000', '500000000000000000'];
const minOuts = ['900000000000000', '1800000000000000', '450000000000000'];
const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes

// Contract automatically selects V2 or V3 for each token
const tx = await dustSwapRouter.batchSwapAuto(
  tokens,
  amounts,
  minOuts,
  deadline
);

await tx.wait();
// Event: RouterVersionUsed(token, version, amountOut)
```

### Example 2: Manual V2/V3 Selection

```javascript
// Force TokenA through V2, TokenB through V3
const configs = [
  {
    token: '0xTokenA...',
    amount: '1000000000000000000',
    minAmountOut: '900000000000000',
    version: 0, // V2
    v3Fee: 0    // Ignored for V2
  },
  {
    token: '0xTokenB...',
    amount: '2000000000000000000',
    minAmountOut: '1800000000000000',
    version: 1, // V3
    v3Fee: 500  // 0.05% fee tier
  },
  {
    token: '0xTokenC...',
    amount: '500000000000000000',
    minAmountOut: '450000000000000',
    version: 2, // AUTO
    v3Fee: 0    // Will be selected automatically
  }
];

const tx = await dustSwapRouter.batchSwapManual(configs, deadline);
```

### Example 3: Check Quotes Before Swapping

```javascript
const token = '0xTokenAddress...';
const amount = '1000000000000000000';

// Get quotes from both versions
const quotes = await dustSwapRouter.getQuotes(token, amount);

console.log('V2 Quote:', quotes.v2Quote.toString());
console.log('V3 Quote:', quotes.v3Quote.toString());
console.log('V3 Best Fee:', quotes.v3Fee); // e.g., 500 = 0.05%

// Compare and swap on best
if (quotes.v3Quote > quotes.v2Quote) {
  console.log('V3 offers better price!');
} else {
  console.log('V2 offers better price!');
}
```

## When to Use V2 vs V3

### Use V2 When:
- ✓ Token has deep V2 liquidity
- ✓ Want to minimize gas costs
- ✓ Trading established tokens (BUSD, USDT, CAKE, etc.)
- ✓ High volatility pairs

### Use V3 When:
- ✓ Trading stablecoins (use 0.01% fee tier)
- ✓ Token has V3-only liquidity
- ✓ Want concentrated liquidity benefits
- ✓ Trading pairs with tight spreads

### Use AUTO When:
- ✓ Unsure which version is better
- ✓ Want maximum output
- ✓ Don't want to manually compare prices
- ✓ **Recommended for most users**

## V3 Fee Tiers Explained

| Fee Tier | Percentage | Best For |
|----------|-----------|----------|
| 100      | 0.01%     | Stablecoin pairs (USDT/BUSD) |
| 500      | 0.05%     | Low volatility pairs |
| 2500     | 0.25%     | Standard pairs (same as V2) |
| 10000    | 1.00%     | Exotic/volatile pairs |

The contract automatically checks all fee tiers in AUTO mode!

## Gas Costs Comparison

**Approximate Gas Usage:**

| Operation | V2 Only | V3 Only | V2/V3 (AUTO) |
|-----------|---------|---------|--------------|
| Single swap | ~130k | ~160k | ~180k (includes quotes) |
| Batch 3 tokens | ~350k | ~430k | ~480k |
| Batch 5 tokens | ~550k | ~680k | ~750k |

**Note:** AUTO mode uses extra gas for price comparison but often results in better net returns.

## Security Features

✅ **Maintained from Original:**
- ReentrancyGuard protection
- Ownable for admin functions
- Slippage protection
- Deadline checks
- Failed swap handling

✅ **New Security:**
- Separate approval for V2 and V3 routers
- Quote failures handled gracefully
- Invalid fee tier validation
- Owner-only fee tier management

## Testing

```bash
cd contracts

# Run V2/V3 router tests
npx hardhat test test/DustSwapRouterV2V3.test.js

# Test on BSC fork
npx hardhat test --network hardhat
```

## Migration Guide

### From Original DustSwapRouter

**No breaking changes!** The original V2-only contract still works.

To upgrade:
1. Deploy `DustSwapRouterV2V3`
2. Update frontend to use new contract address
3. Users can continue using V2-only if preferred
4. Use `batchSwapAuto()` instead of `batchSwapExactTokensForETH()`

### API Changes

**Old (V2 only):**
```solidity
batchSwapExactTokensForETH(
    address[] tokens,
    uint256[] amounts,
    uint256[] minOuts,
    uint256 deadline
)
```

**New (V2/V3 AUTO):**
```solidity
batchSwapAuto(
    address[] tokens,
    uint256[] amounts,
    uint256[] minOuts,
    uint256 deadline
)
```

Same function signature! Just replace the function name.

## Frontend Integration

The frontend automatically works with V2/V3 router:

1. Detects contract supports V2/V3
2. Calls `batchSwapAuto()` for best prices
3. Shows which version was used per token
4. Displays savings from optimal routing

## FAQ

**Q: Will V3 always give better prices?**
A: Not always. V2 often has better liquidity for established tokens. That's why AUTO mode compares both!

**Q: Can I force all swaps through V2?**
A: Yes! Use `batchSwapManual()` and set `version: RouterVersion.V2` for all tokens.

**Q: Does this work with tokens that only have V2 liquidity?**
A: Yes! V3 quote will return 0, and AUTO will automatically use V2.

**Q: What happens if both V2 and V3 fail?**
A: The contract returns tokens to the user. No funds are lost.

**Q: Do I need to approve tokens twice (V2 and V3)?**
A: No! You approve to DustSwapRouter, which handles both internally.

## Performance Tips

1. **Use AUTO mode** - Small gas overhead but often better net returns
2. **Batch more tokens** - Gas cost per token decreases with larger batches
3. **Check quotes first** - Use `getQuotes()` to preview before swapping
4. **Stablecoins**: Manually specify V3 with 100 fee tier for best rates
5. **High volume tokens**: V2 usually has better liquidity

## Comparison: V2 vs V3 vs V2/V3

| Feature | V2 Only | V3 Only | V2/V3 (This) |
|---------|---------|---------|--------------|
| PancakeSwap V2 Support | ✅ | ❌ | ✅ |
| PancakeSwap V3 Support | ❌ | ✅ | ✅ |
| Auto best price | ❌ | ❌ | ✅ |
| Multiple fee tiers | ❌ | ✅ | ✅ |
| Lowest gas cost | ✅ | ❌ | ❌ |
| Best overall value | ❌ | ❌ | ✅ |

## Resources

- [PancakeSwap V2 Docs](https://docs.pancakeswap.finance/products/pancakeswap-exchange/v2)
- [PancakeSwap V3 Docs](https://docs.pancakeswap.finance/products/pancakeswap-exchange)
- [Uniswap V3 Whitepaper](https://uniswap.org/whitepaper-v3.pdf)
- [BSC Explorer](https://bscscan.com/)

## Summary

✅ **Best of both worlds**: Combines V2 liquidity with V3 efficiency
✅ **Automatic optimization**: Always get the best price
✅ **Flexible**: Manual control when needed
✅ **Backward compatible**: Drop-in replacement for V2-only router
✅ **Production ready**: Compiled and tested

**Deploy the V2/V3 router and start getting better prices for your dust swaps!** 🚀
