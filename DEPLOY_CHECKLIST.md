# DustSwap Deployment Checklist

## ✅ Pre-Deployment Verification

### Smart Contract Status
- [x] Contract compiles successfully
- [x] Off-chain quoting implemented
- [x] Token → ERC20 output (DustSwapRouterX)
- [x] Mutable service fee (0–50%, default 20%, basis points)
- [x] Fee recipient configurable (owner)
- [x] Output token configurable (owner, 48 h timelock)
- [x] Deployment script updated (`deployRouterX.js`)

### Frontend Status
- [x] Off-chain quoting service created
- [x] Batch approval service created
- [x] SwapCard updated with new flow
- [x] Production build succeeds
- [x] TypeScript types fixed
- [x] UI shows fee breakdown

---

## 📋 Deployment Steps

### Step 1: Configure Contract Environment

```bash
cd /workspaces/DustSwap/contracts
cp .env.example .env
```

Edit `.env`:
```env
# REQUIRED
PRIVATE_KEY=your_deployer_private_key_here

# OPTIONAL — RouterX defaults apply if omitted
FEE_RECIPIENT=0xYourFeeRecipientAddressHere  # defaults to deployer
INITIAL_FEE_BPS=2000                          # 20% default; max 5000 (50%)
OUTPUT_TOKEN=0x55d398326f99059fF775485246999027B3197955  # USDT default

BSC_RPC_URL=https://bsc-dataseed.binance.org/
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
BSCSCAN_API_KEY=your_bscscan_api_key_here
```

### Step 2: Deploy to BSC Testnet (Recommended First)

```bash
# From /workspaces/DustSwap/contracts
npx hardhat run scripts/deployRouterX.js --network bscTestnet
```

**Expected Output:**
```
🚀 Deploying DustSwapRouterV2V3...

Network: bscTestnet

📋 Using PancakeSwap addresses:
  V2 Router: 0xD99D1c33F9fC3444f8101754aBC46c52416550D1
  V3 Router: 0x1b81D678ffb9C0263b24A97847620C99d213eB14

💰 Fee Recipient: 0xYour...Address
   (10% service fee will be sent here)

✅ DustSwapRouterV2V3 deployed to: 0x...
✅ Confirmed!
🔍 Verifying contract on BscScan...
✅ Contract verified!

=============================================================
🎉 DEPLOYMENT COMPLETE!
=============================================================

📝 Next steps:
1. Update frontend .env file:
   VITE_DUSTSWAP_ROUTER_ADDRESS=0x...
```

**Save this address!** → `0x...`

### Step 3: Configure Frontend

```bash
cd /workspaces/DustSwap/frontend
cp .env.example .env
```

Edit `.env`:
```env
# BSC RPC (use public or your own)
VITE_BSC_RPC_URL=https://bsc-dataseed.binance.org/

# DexScreener API (no key needed)
VITE_DEXSCREENER_API=https://api.dexscreener.com

# YOUR DEPLOYED CONTRACT ADDRESS (from Step 2)
VITE_DUSTSWAP_ROUTER_ADDRESS=0x...  # ← PASTE HERE

# PancakeSwap V2 Router (BSC Mainnet)
VITE_PANCAKESWAP_V2_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E

# PancakeSwap V3 Router (BSC Mainnet)
VITE_PANCAKESWAP_V3_ROUTER=0x1b81D678ffb9C0263b24A97847620C99d213eB14

# PancakeSwap V3 Quoter (BSC Mainnet)
VITE_PANCAKESWAP_V3_QUOTER=0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997

# WBNB Address
VITE_WBNB_ADDRESS=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
```

### Step 4: Run Development Server

```bash
# From /workspaces/DustSwap/frontend
npm run dev
```

**Expected Output:**
```
VITE v7.3.1  ready in 543 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

Open: http://localhost:5173

### Step 5: Test on Testnet

1. **Connect Wallet**
   - Click "Connect Wallet"
   - Approve MetaMask connection
   - Switch to BSC Testnet if needed

2. **Get Test Tokens**
   - Visit BSC Testnet Faucet: https://testnet.bnbchain.org/faucet-smart
   - Get test BNB
   - Swap some for test tokens on PancakeSwap Testnet

3. **Test Token Detection**
   - Should auto-detect your test tokens
   - See real-time prices from DexScreener
   - Check liquidity information

4. **Test Off-Chain Quoting**
   - Select tokens to swap
   - Should see quotes instantly (off-chain)
   - Verify fee calculation (10%)
   - Check "You Receive" amount

5. **Test Batch Approvals**
   - Click "Approve & Swap to BNB"
   - Watch approval progress (1/N, 2/N, etc.)
   - Confirm each approval in MetaMask

6. **Test Swap Execution**
   - After approvals, swap executes
   - Monitor transaction on BscScan
   - Verify BNB received
   - **Check fee recipient balance** (should have 10%)

### Step 6: Deploy to BSC Mainnet

⚠️ **Only after successful testnet testing!**

```bash
cd /workspaces/DustSwap/contracts

# Deploy RouterX to mainnet
npx hardhat run scripts/deployRouterX.js --network bscMainnet
```

Update frontend `.env`:
```env
VITE_DUSTSWAP_ROUTER_ADDRESS=0x...  # New mainnet address
```

### Step 7: Build for Production

```bash
cd /workspaces/DustSwap/frontend
npm run build
```

**Expected Output:**
```
vite v7.3.1 building for production...
✓ 186 modules transformed.
dist/index.html                   0.46 kB
dist/assets/index-*.css          14.32 kB
dist/assets/index-*.js          477.93 kB
✓ built in 2.72s
```

Deploy `dist/` folder to:
- Vercel: `vercel --prod`
- Netlify: `netlify deploy --prod`
- IPFS: `ipfs add -r dist/`
- Traditional: Upload `dist/` to web server

---

## 🧪 Testing Checklist

### Smart Contract Tests
- [ ] Deploy succeeds
- [ ] Fee recipient set correctly
- [ ] Output token set correctly
- [ ] Single token swap works (V2)
- [ ] Single token swap works (V3)
- [ ] Batch swap (3+ tokens) works
- [ ] Fee deducted correctly at configured rate
- [ ] Fee sent to recipient in outputToken
- [ ] User receives outputToken minus fee
- [ ] `setFee()` works, rejects > 5000 bps
- [ ] `proposeOutputToken()` queues change and emits OutputTokenProposed
- [ ] `applyOutputToken()` reverts before 48 h, applies after
- [ ] `cancelOutputToken()` clears pending proposal
- [ ] `proposeOutputToken()` rejects WBNB / zero address
- [ ] Failed swap returns tokens to user
- [ ] Emergency withdraw works (owner only)

### Frontend Tests
- [ ] Wallet connects
- [ ] Network switches to BSC
- [ ] Tokens auto-detected
- [ ] DexScreener prices load
- [ ] Off-chain quotes instant
- [ ] Fee breakdown displays correctly
- [ ] Batch approvals show progress
- [ ] Swap executes successfully
- [ ] Transaction links to BscScan
- [ ] Success message shows correct amount
- [ ] Responsive on mobile

### Integration Tests
- [ ] Quote Token A via V2 and V3
- [ ] Quote Token B via V2 and V3
- [ ] Client selects best route
- [ ] Approve Token A
- [ ] Approve Token B
- [ ] Execute batch swap
- [ ] Verify 10% to fee recipient
- [ ] Verify 90% to user
- [ ] Check BscScan transaction

---

## 🔍 Verification Commands

### Check Contract Deployment
```bash
# View on BscScan
https://bscscan.com/address/0xYourContractAddress

# Check fee recipient
cast call 0xYourContractAddress "feeRecipient()" --rpc-url https://bsc-dataseed.binance.org/

# Check current fee (basis points)
cast call 0xYourContractAddress "serviceFee()" --rpc-url https://bsc-dataseed.binance.org/

# Check active output token
cast call 0xYourContractAddress "outputToken()" --rpc-url https://bsc-dataseed.binance.org/

# Check pending output token (address(0) if none queued)
cast call 0xYourContractAddress "pendingOutputToken()" --rpc-url https://bsc-dataseed.binance.org/
cast call 0xYourContractAddress "pendingOutputTokenActiveAt()" --rpc-url https://bsc-dataseed.binance.org/
```

### Check Frontend
```bash
# Test build locally
cd /workspaces/DustSwap/frontend
npm run build
npm run preview
# Open http://localhost:4173
```

### Monitor Fees
```bash
# Check fee recipient balance
cast balance 0xYourFeeRecipient --rpc-url https://bsc-dataseed.binance.org/

# Watch for swap events
cast logs \
  --address 0xYourContractAddress \
  --event "BatchSwapCompleted(address,uint256,uint256,uint256,uint256)" \
  --rpc-url https://bsc-dataseed.binance.org/
```

---

## 📊 Post-Deployment Monitoring

### Track Metrics
- Total swaps executed
- Total BNB swapped
- Total fees collected
- Average tokens per swap
- Most swapped tokens
- User retention

### Monitor Health
- Transaction success rate
- Average gas used
- Failed swaps (and reasons)
- Quote accuracy (expected vs actual)
- API uptime (DexScreener, RPC)

### User Feedback
- Swap completion time
- UI/UX issues
- Token detection accuracy
- Quote speed
- Approval flow clarity

---

## 🚨 Troubleshooting

### Contract Issues
**"Transaction failed"**
- Check gas limit (increase to 500k)
- Verify tokens have liquidity
- Check slippage tolerance

**"Invalid fee recipient"**
- FEE_RECIPIENT must be non-zero address
- Redeploy with valid address

**"Transfer failed"**
- User may not have enough tokens
- Token may have transfer restrictions
- Check token approval

### Frontend Issues
**"No quotes available"**
- Check RPC URL is accessible
- Verify PancakeSwap addresses are correct
- Check DexScreener API is up

**"Approval failed"**
- User rejected transaction
- Insufficient gas
- Token has non-standard approval

**"Contract not deployed"**
- Check VITE_DUSTSWAP_ROUTER_ADDRESS is set
- Verify you're on correct network
- Redeploy if needed

---

## 📝 Important Addresses

### BSC Mainnet
```
DustSwapRouter:    0x...  (your deployed address)
Fee Recipient:     0x...  (your fee address)
PancakeSwap V2:    0x10ED43C718714eb63d5aA57B78B54704E256024E
PancakeSwap V3:    0x1b81D678ffb9C0263b24A97847620C99d213eB14
WBNB:              0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
```

### BSC Testnet
```
DustSwapRouter:    0x...  (your deployed address)
Fee Recipient:     0x...  (your fee address)
PancakeSwap V2:    0xD99D1c33F9fC3444f8101754aBC46c52416550D1
```

---

## ✅ Final Checklist

- [ ] Contract deployed to testnet
- [ ] Contract tested thoroughly
- [ ] Fee recipient verified
- [ ] Frontend configured
- [ ] Off-chain quoting works
- [ ] Batch approvals work
- [ ] Swap executes successfully
- [ ] 10% fee collected correctly
- [ ] Contract deployed to mainnet
- [ ] Frontend deployed to production
- [ ] Monitoring set up
- [ ] Documentation updated
- [ ] Team trained on operations

---

## 🎉 Success Criteria

✅ User can swap dust tokens to BNB
✅ Off-chain quotes are instant (<1 second)
✅ Batch approvals show clear progress
✅ 10% fee automatically deducted
✅ Fee recipient receives funds
✅ User receives 90% of BNB
✅ Gas costs are optimized (~150k)
✅ UI is clear and user-friendly
✅ Transactions complete successfully
✅ Revenue stream established

**All criteria met? You're ready to launch! 🚀**
