const hre = require("hardhat");

async function main() {
  console.log("Deploying DustSwapRouter...");

  // PancakeSwap Router V2 address on BSC
  const PANCAKE_ROUTER_V2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

  // Get the deployer's address
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy DustSwapRouter
  const DustSwapRouter = await hre.ethers.getContractFactory("DustSwapRouter");
  const dustSwapRouter = await DustSwapRouter.deploy(PANCAKE_ROUTER_V2);

  await dustSwapRouter.waitForDeployment();

  const dustSwapAddress = await dustSwapRouter.getAddress();
  console.log("DustSwapRouter deployed to:", dustSwapAddress);
  console.log("PancakeSwap Router:", PANCAKE_ROUTER_V2);

  // Wait for block confirmations before verifying
  console.log("Waiting for block confirmations...");
  await dustSwapRouter.deploymentTransaction().wait(5);

  // Verify contract on BscScan (if not on hardhat network)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Verifying contract on BscScan...");
    try {
      await hre.run("verify:verify", {
        address: dustSwapAddress,
        constructorArguments: [PANCAKE_ROUTER_V2],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  console.log("\n=== Deployment Summary ===");
  console.log("DustSwapRouter:", dustSwapAddress);
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("\nSave this address to your frontend .env file:");
  console.log(`VITE_DUSTSWAP_ROUTER_ADDRESS=${dustSwapAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
