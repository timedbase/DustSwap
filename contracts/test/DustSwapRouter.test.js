const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DustSwapRouter", function () {
  let dustSwapRouter;
  let owner;
  let user;
  const PANCAKE_ROUTER_V2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const DustSwapRouter = await ethers.getContractFactory("DustSwapRouter");
    dustSwapRouter = await DustSwapRouter.deploy(PANCAKE_ROUTER_V2);
    await dustSwapRouter.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct PancakeSwap router", async function () {
      expect(await dustSwapRouter.pancakeRouter()).to.equal(PANCAKE_ROUTER_V2);
    });

    it("Should set the correct owner", async function () {
      expect(await dustSwapRouter.owner()).to.equal(owner.address);
    });

    it("Should have WBNB address set", async function () {
      const wbnb = await dustSwapRouter.WBNB();
      expect(wbnb).to.not.equal(ethers.ZeroAddress);
    });

    it("Should revert with invalid router address", async function () {
      const DustSwapRouter = await ethers.getContractFactory("DustSwapRouter");
      await expect(
        DustSwapRouter.deploy(ethers.ZeroAddress)
      ).to.be.reverted;
    });
  });

  describe("Batch Swap Validation", function () {
    it("Should revert if deadline is expired", async function () {
      const expiredDeadline = Math.floor(Date.now() / 1000) - 100;

      await expect(
        dustSwapRouter.batchSwapExactTokensForETH(
          [],
          [],
          [],
          expiredDeadline
        )
      ).to.be.revertedWithCustomError(dustSwapRouter, "DeadlineExpired");
    });

    it("Should revert with empty token list", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 300;

      await expect(
        dustSwapRouter.batchSwapExactTokensForETH(
          [],
          [],
          [],
          deadline
        )
      ).to.be.revertedWithCustomError(dustSwapRouter, "EmptySwapList");
    });

    it("Should revert with mismatched array lengths", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 300;
      const tokens = [ethers.Wallet.createRandom().address];
      const amounts = [ethers.parseEther("1")];
      const minAmounts = [];

      await expect(
        dustSwapRouter.batchSwapExactTokensForETH(
          tokens,
          amounts,
          minAmounts,
          deadline
        )
      ).to.be.reverted;
    });
  });

  describe("Emergency Withdraw", function () {
    it("Should allow user to withdraw their stuck tokens", async function () {
      // Send some BNB to the contract
      await owner.sendTransaction({
        to: await dustSwapRouter.getAddress(),
        value: ethers.parseEther("1")
      });

      const balanceBefore = await ethers.provider.getBalance(user.address);

      await dustSwapRouter.connect(user).emergencyWithdraw(
        ethers.ZeroAddress,
        ethers.parseEther("1")
      );

      const balanceAfter = await ethers.provider.getBalance(user.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  describe("Receive Function", function () {
    it("Should accept BNB transfers", async function () {
      const tx = await owner.sendTransaction({
        to: await dustSwapRouter.getAddress(),
        value: ethers.parseEther("1")
      });

      await tx.wait();

      const balance = await ethers.provider.getBalance(
        await dustSwapRouter.getAddress()
      );
      expect(balance).to.equal(ethers.parseEther("1"));
    });
  });
});
