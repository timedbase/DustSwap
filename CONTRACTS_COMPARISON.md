# DustSwap Contracts Comparison

## Available Contracts

DustSwap offers **three smart contract options** to suit different needs:

### 1. DustSwapRouter (V2 Only)
**File:** `contracts/DustSwapRouter.sol`
**Best for:** Simplicity, lower gas costs, established tokens

### 2. DustSwapRouterV2V3 (V2 + V3 Support)
**File:** `contracts/DustSwapRouterV2V3.sol`
**Best for:** Maximum BNB output, automatic optimization, better rates

### 3. DustSwapRouterX (V2 + V3, ERC20 output, mutable fee) ⭐ Recommended
**File:** `contracts/DustSwapRouterX.sol`
**Best for:** Production deployments — owner-controlled fee and ERC20 output token

---

## Quick Comparison

| Feature | DustSwapRouter (V2) | DustSwapRouterV2V3 (V2+V3) | DustSwapRouterX |
|---------|-------------------|------------------------|-----------------|
| **PancakeSwap V2** | ✅ | ✅ | ✅ |
| **PancakeSwap V3** | ❌ | ✅ | ✅ |
| **Output token** | BNB | BNB | ERC20 (e.g. USDT) |
| **Output token updatable** | ❌ | ❌ | ✅ owner |
| **Service fee** | None | Fixed 10% | Mutable 0–50% |
| **Fee updatable** | ❌ | ❌ | ✅ owner |
| **Manual routing** | ❌ | ✅ | ✅ |
| **Gas cost** | Lower | Slightly higher | Slightly higher |
| **Use case** | Simple swaps | BNB output | Production / revenue |

---

## Detailed Comparison

### DustSwapRouter (V2 Only)

**Pros:**
- ✅ Simple and straightforward
- ✅ Lower gas costs (~15-20% less)
- ✅ Works great for most tokens
- ✅ Deep V2 liquidity for established tokens
- ✅ Battle-tested V2 technology

**Cons:**
- ❌ Misses V3 opportunities
- ❌ May get worse rates on stablecoins
- ❌ Cannot access V3-only tokens
- ❌ Fixed 0.25% fee tier only

**Best for:**
- Users who want simple, predictable swaps
- Tokens with strong V2 liquidity
- Minimizing gas costs
- Quick deployments

**Functions:**
```solidity
// Batch swap to BNB
batchSwapExactTokensForETH(
    address[] tokens,
    uint256[] amounts,
    uint256[] minOuts,
    uint256 deadline
)

// Batch swap to any token
batchSwapExactTokensForTokens(
    address[] tokensIn,
    uint256[] amountsIn,
    address tokenOut,
    uint256[] minOuts,
    uint256 deadline
)

// Get estimated outputs
getEstimatedBNBOutputs(
    address[] tokens,
    uint256[] amounts
)
```

---

### DustSwapRouterV2V3 (V2 + V3 Support)

**Pros:**
- ✅ Always gets best price (V2 or V3)
- ✅ Better rates for stablecoins
- ✅ Access to V3-only tokens
- ✅ Multiple fee tier options
- ✅ Future-proof design
- ✅ Smart route selection

**Cons:**
- ❌ Slightly higher gas (~15-20% more)
- ❌ More complex contract
- ❌ Requires more testing

**Best for:**
- Users who want maximum output
- Trading stablecoins
- Optimizing every swap
- Access to all liquidity

**Functions:**
```solidity
// Automatic best price selection (RECOMMENDED)
batchSwapAuto(
    address[] tokens,
    uint256[] amounts,
    uint256[] minOuts,
    uint256 deadline
)

// Manual V2/V3 control
batchSwapManual(
    SwapConfig[] configs,
    uint256 deadline
)

// Compare V2 vs V3 quotes
getQuotes(
    address token,
    uint256 amount
) returns (uint256 v2Quote, uint256 v3Quote, uint24 v3Fee)
```

---

## Gas Cost Analysis

**Estimated gas per swap (single token):**

| Contract | Gas Cost | USD Cost @ 3 gwei | When Worth It |
|----------|----------|-------------------|---------------|
| V2 Only | ~130,000 | ~$0.20 | Always efficient |
| V2+V3 Auto | ~180,000 | ~$0.28 | If you save >$0.08 |

**Break-even calculation:**
- Extra gas cost: ~50,000 gas (~$0.08)
- If V3 gives 0.5% better rate on $100 swap = $0.50 saved
- Net benefit: $0.42 profit

**Conclusion:** V2+V3 is worth it for swaps >$20 value

---

## When to Use Each

### Use DustSwapRouter (V2 Only) When:

1. **Gas Efficiency Priority**
   - Trading small amounts (<$20)
   - Want to minimize gas costs
   - Quick, simple swaps

2. **Token Characteristics**
   - Well-established tokens (CAKE, BUSD, USDT V2 pairs)
   - High V2 liquidity
   - No V3 pools available

3. **Deployment Constraints**
   - Want simpler contract
   - Easier auditing
   - Faster deployment

### Use DustSwapRouterV2V3 (V2+V3) When:

1. **Output Optimization**
   - Trading larger amounts (>$50)
   - Every basis point matters
   - Want best possible rate

2. **Token Characteristics**
   - Stablecoins (USDT, BUSD, USDC)
   - Tokens with V3-only liquidity
   - New tokens

3. **Advanced Usage**
   - Need manual routing control
   - Want to compare quotes
   - Future-proof deployment

---

## Deployment Guide

### Deploy V2 Only

```bash
cd contracts
npx hardhat run scripts/deploy.js --network bscMainnet
```

**Environment:**
```env
# .env
PRIVATE_KEY=your_key
BSC_RPC_URL=https://bsc-dataseed.binance.org/
BSCSCAN_API_KEY=your_api_key
```

### Deploy V2+V3

```bash
cd contracts
npx hardhat run scripts/deployV2V3.js --network bscMainnet
```

### Deploy RouterX (recommended)

```bash
cd contracts
npx hardhat run scripts/deployRouterX.js --network bscMainnet
```

**Environment:**
```env
PRIVATE_KEY=your_key
BSC_RPC_URL=https://bsc-dataseed.binance.org/
BSCSCAN_API_KEY=your_api_key

# RouterX-specific (all optional — defaults apply)
FEE_RECIPIENT=0xYourFeeAddress       # defaults to deployer
INITIAL_FEE_BPS=2000                 # 20% default, max 5000 (50%)
OUTPUT_TOKEN=0x55d398326f99059fF775485246999027B3197955  # USDT default
```

---

## Frontend Configuration

### For V2 Only

```env
# frontend/.env
VITE_DUSTSWAP_ROUTER_ADDRESS=<deployed_v2_address>
VITE_PANCAKESWAP_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
```

### For V2+V3

```env
# frontend/.env
VITE_DUSTSWAP_ROUTER_ADDRESS=<deployed_v2v3_address>
VITE_PANCAKESWAP_V2_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
VITE_PANCAKESWAP_V3_ROUTER=0x1b81D678ffb9C0263b24A97847620C99d213eB14
VITE_PANCAKESWAP_V3_QUOTER=0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997
```

---

## Migration Path

### From V2 to V2+V3

**Good news:** Frontend works with both! Just update contract address.

**Steps:**
1. Deploy V2+V3 contract
2. Update `VITE_DUSTSWAP_ROUTER_ADDRESS` in frontend .env
3. Add V3 addresses to .env
4. Restart frontend
5. Done! Automatically uses V2+V3

**No code changes needed!** The frontend detects capabilities automatically.

---

## Real-World Examples

### Example 1: Dust Tokens (Mixed)

**Tokens to swap:**
- 50 USDT (stablecoin)
- 0.1 CAKE (established)
- 1000 NEWTOKEN (low liquidity)

**V2 Only Result:**
- USDT: 0.1182 BNB (V2 0.25% fee)
- CAKE: 0.0245 BNB (V2)
- NEWTOKEN: 0.0088 BNB (V2)
- **Total: 0.1515 BNB**

**V2+V3 Auto Result:**
- USDT: 0.1194 BNB (V3 0.01% fee ✨)
- CAKE: 0.0245 BNB (V2, same)
- NEWTOKEN: 0.0091 BNB (V3 0.25% ✨)
- **Total: 0.1530 BNB**

**Savings: 0.0015 BNB (~$0.90)** 💰

### Example 2: Large USDT Dust

**Amount:** 500 USDT

**V2 Only:**
- Output: 1.182 BNB
- Fee: 0.25% = 1.25 USDT
- Net: 1.182 BNB

**V2+V3 Auto:**
- Output: 1.194 BNB
- Fee: 0.01% = 0.05 USDT
- Net: 1.194 BNB

**Difference: 0.012 BNB (~$7.20)** 💰

Gas cost difference: ~$0.08
**Net profit: $7.12** 🎉

---

## Performance Comparison

### Throughput

| Metric | V2 Only | V2+V3 Auto |
|--------|---------|------------|
| Swap time | ~3-5 sec | ~4-6 sec |
| Quote time | ~1 sec | ~2 sec |
| Batch 5 tokens | ~8 sec | ~10 sec |

### Success Rate

Both contracts handle failures gracefully:
- ✅ Return tokens if swap fails
- ✅ Continue with other tokens in batch
- ✅ No funds lost

---

## Recommendation Matrix

| Your Situation | Recommended Contract | Why |
|----------------|---------------------|-----|
| Small swaps (<$20) | V2 Only | Gas efficiency |
| Large swaps (>$50) | V2+V3 Auto | Better output |
| Stablecoins | V2+V3 Auto | V3 0.01% pools |
| Established tokens | V2 Only | V2 has deep liquidity |
| New/exotic tokens | V2+V3 Auto | Access V3 pools |
| Unsure | V2+V3 Auto | Always best price |

---

## Conclusion

### Choose V2 Only If:
- ✅ You want simplicity
- ✅ Gas costs matter most
- ✅ Trading established tokens
- ✅ Small dust amounts

### Choose V2+V3 If:
- ✅ You want maximum output
- ✅ Trading stablecoins or large amounts
- ✅ Want future-proof solution
- ✅ Need access to all liquidity

### Our Recommendation:

**For production deployments: DustSwapRouterX** 🎯

Why? It gives full operator control — adjust the fee at any time (0–50%), change the output token without redeploying, and route via both V2 and V3 for best prices. Users receive a stable ERC20 (e.g. USDT) instead of volatile BNB.

---

## Further Reading

- **V2 Only Documentation:** See [README.md](./README.md)
- **V2+V3 Full Guide:** See [V2V3_GUIDE.md](./V2V3_GUIDE.md)
- **Quick Start:** See [QUICKSTART.md](./QUICKSTART.md)
- **Technical Details:** See [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)

---

## Support

Questions? Check out:
- **V2 issues:** Review V2 router tests
- **V3 issues:** Review V2+V3 router tests
- **General help:** See QUICKSTART.md

**Both contracts are production-ready!** Choose based on your needs. 🚀
