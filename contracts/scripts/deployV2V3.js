const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying DustSwapRouterV2V3...\n");

  // Get network
  const network = hre.network.name;
  console.log("Network:", network);

  // PancakeSwap contract addresses
  let pancakeRouterV2, pancakeRouterV3, pancakeQuoterV3;

  if (network === "bscMainnet" || network === "bsc") {
    // BSC Mainnet
    pancakeRouterV2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // V2 Router
    pancakeRouterV3 = "0x1b81D678ffb9C0263b24A97847620C99d213eB14"; // V3 SmartRouter
    pancakeQuoterV3 = "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997"; // V3 Quoter
  } else if (network === "bscTestnet") {
    // BSC Testnet
    pancakeRouterV2 = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"; // V2 Router
    pancakeRouterV3 = "0x1b81D678ffb9C0263b24A97847620C99d213eB14"; // V3 SmartRouter (if available)
    pancakeQuoterV3 = "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997"; // V3 Quoter (if available)
  } else {
    console.error("❌ Unsupported network");
    process.exit(1);
  }

  console.log("\n📋 Using PancakeSwap addresses:");
  console.log("  V2 Router:", pancakeRouterV2);
  console.log("  V3 Router:", pancakeRouterV3);
  console.log("  V3 Quoter:", pancakeQuoterV3);
  console.log();

  // Get deployer address for fee recipient
  const [deployer] = await hre.ethers.getSigners();
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;

  console.log("💰 Fee Recipient:", feeRecipient);
  console.log("   (10% service fee will be sent here)");
  console.log();

  // Deploy contract
  const DustSwapRouterV2V3 = await hre.ethers.getContractFactory("DustSwapRouterV2V3");
  const dustSwapRouter = await DustSwapRouterV2V3.deploy(
    pancakeRouterV2,
    pancakeRouterV3,
    feeRecipient
  );

  await dustSwapRouter.waitForDeployment();
  const address = await dustSwapRouter.getAddress();

  console.log("✅ DustSwapRouterV2V3 deployed to:", address);
  console.log();

  // Wait for block confirmations
  console.log("⏳ Waiting for block confirmations...");
  await dustSwapRouter.deploymentTransaction().wait(5);
  console.log("✅ Confirmed!");
  console.log();

  // Verify contract on BscScan
  if (network !== "hardhat" && network !== "localhost") {
    console.log("🔍 Verifying contract on BscScan...");
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [pancakeRouterV2, pancakeRouterV3, feeRecipient],
      });
      console.log("✅ Contract verified!");
    } catch (error) {
      console.log("⚠️  Verification failed:", error.message);
      console.log("You can verify manually later with:");
      console.log(`npx hardhat verify --network ${network} ${address} ${pancakeRouterV2} ${pancakeRouterV3} ${feeRecipient}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📝 Next steps:");
  console.log("1. Update frontend .env file:");
  console.log(`   VITE_DUSTSWAP_ROUTER_ADDRESS=${address}`);
  console.log(`   VITE_PANCAKESWAP_V2_ROUTER=${pancakeRouterV2}`);
  console.log(`   VITE_PANCAKESWAP_V3_ROUTER=${pancakeRouterV3}`);
  console.log(`   VITE_PANCAKESWAP_V3_QUOTER=${pancakeQuoterV3}`);
  console.log("\n2. Test the contract:");
  console.log(`   npx hardhat console --network ${network}`);
  console.log("\n3. Run the frontend:");
  console.log("   cd ../frontend && npm run dev");
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
