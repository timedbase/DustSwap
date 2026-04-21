const hre = require("hardhat");

/**
 * Deploy DustSwapRouterX — V2+V3 router with mutable fee and ERC20 output token.
 *
 * Environment variables (all optional, fall back to defaults below):
 *   FEE_RECIPIENT   — address that collects the service fee (defaults to deployer)
 *   INITIAL_FEE_BPS — service fee in basis points, e.g. 1000 = 10% (default: 2000)
 *   OUTPUT_TOKEN    — ERC20 output token address (default: USDT per network)
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  console.log(`\nDeploying DustSwapRouterX`);
  console.log(`  Network:  ${network} (chainId ${chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(
    `  Balance:  ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} BNB\n`
  );

  // ─── Addresses per network ────────────────────────────────────────────────

  const ADDRESSES = {
    // BSC Mainnet
    56: {
      pancakeRouterV2: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
      pancakeRouterV3: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
      defaultOutputToken: "0x55d398326f99059fF775485246999027B3197955", // BSC-USD (USDT)
    },
    // BSC Testnet
    97: {
      pancakeRouterV2: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
      pancakeRouterV3: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
      defaultOutputToken: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", // USDT testnet
    },
  };

  const addrs = ADDRESSES[chainId];
  if (!addrs) throw new Error(`Unsupported chainId: ${chainId}`);

  // ─── Constructor arguments ────────────────────────────────────────────────

  const pancakeRouterV2 = addrs.pancakeRouterV2;
  const pancakeRouterV3 = addrs.pancakeRouterV3;
  const outputToken = process.env.OUTPUT_TOKEN || addrs.defaultOutputToken;
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  const initialFeeBps = parseInt(process.env.INITIAL_FEE_BPS ?? "2000"); // 20% default

  console.log("Constructor arguments:");
  console.log(`  pancakeRouterV2 : ${pancakeRouterV2}`);
  console.log(`  pancakeRouterV3 : ${pancakeRouterV3}`);
  console.log(`  outputToken     : ${outputToken}`);
  console.log(`  feeRecipient    : ${feeRecipient}`);
  console.log(`  initialFee      : ${initialFeeBps} bps (${initialFeeBps / 100}%)\n`);

  // ─── Deploy ───────────────────────────────────────────────────────────────

  const Factory = await hre.ethers.getContractFactory("DustSwapRouterX");
  const router = await Factory.deploy(
    pancakeRouterV2,
    pancakeRouterV3,
    outputToken,
    feeRecipient,
    initialFeeBps
  );

  await router.waitForDeployment();
  const address = await router.getAddress();
  console.log(`DustSwapRouterX deployed to: ${address}`);

  // Wait for confirmations before verifying
  if (network !== "hardhat" && network !== "localhost") {
    console.log("\nWaiting for 5 block confirmations...");
    await router.deploymentTransaction().wait(5);

    console.log("\nVerifying on BscScan...");
    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments: [
          pancakeRouterV2,
          pancakeRouterV3,
          outputToken,
          feeRecipient,
          initialFeeBps,
        ],
      });
      console.log("Verification successful.");
    } catch (err) {
      if (err.message.includes("Already Verified")) {
        console.log("Contract already verified.");
      } else {
        console.warn("Verification failed:", err.message);
      }
    }
  }

  console.log("\n=== Deployment Summary ===");
  console.log(`Contract   : DustSwapRouterX`);
  console.log(`Address    : ${address}`);
  console.log(`Output     : ${outputToken}`);
  console.log(`Fee        : ${initialFeeBps} bps`);
  console.log(`Recipient  : ${feeRecipient}`);
  console.log(`Network    : ${network}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
