import { expect } from "chai";
import { ethers } from "hardhat";
import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("VoidGateway", function () {
  async function deployGatewayFixture() {
    const [owner, user, recipient] = await ethers.getSigners();

    const v1 = ethers.Wallet.createRandom().connect(ethers.provider);
    const v2 = ethers.Wallet.createRandom().connect(ethers.provider);
    const v3 = ethers.Wallet.createRandom().connect(ethers.provider);

    const validatorWallets = [v1, v2, v3].sort((a, b) =>
      a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1
    );
    const validatorAddresses = validatorWallets.map((w) => w.address);

    const VoidGateway = await ethers.getContractFactory("VoidGateway");
    const gateway = await VoidGateway.deploy(validatorAddresses, 2);
    await gateway.waitForDeployment();

    await gateway.setSupportedToken(ethers.ZeroAddress, true);

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20.deploy("Mock USDC", "mUSDC");
    await mockToken.waitForDeployment();

    await gateway.setSupportedToken(await mockToken.getAddress(), true);

    const mintAmount = ethers.parseUnits("1000000", 18);
    await mockToken.mint(owner.address, mintAmount);
    await mockToken.mint(user.address, mintAmount);

    return {
      gateway,
      mockToken,
      owner,
      user,
      recipient,
      validatorWallets,
      validatorAddresses,
    };
  }

  function makeCommitment(
    sender: string,
    token: string,
    amount: bigint,
    targetChainId: bigint,
    recipientHash: string,
    salt: string
  ): string {
    return ethers.solidityPackedKeccak256(
      ["address", "address", "uint256", "uint256", "bytes32", "bytes32"],
      [sender, token, amount, targetChainId, recipientHash, salt]
    );
  }

  async function signProof(
    wallets: ethers.Wallet[],
    proofHash: string
  ): Promise<{ signers: string[]; signatures: string[] }> {
    const sorted = [...wallets].sort((a, b) =>
      a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1
    );
    const signers: string[] = [];
    const signatures: string[] = [];

    for (const w of sorted) {
      signers.push(w.address);
      const sig = await w.signMessage(ethers.getBytes(proofHash));
      signatures.push(sig);
    }

    return { signers, signatures };
  }

  describe("Deployment", function () {
    it("should deploy with correct validators and threshold", async function () {
      const { gateway, validatorAddresses } = await loadFixture(
        deployGatewayFixture
      );

      expect(await gateway.threshold()).to.equal(2);
      expect(await gateway.validatorCount()).to.equal(3);

      for (const addr of validatorAddresses) {
        expect(await gateway.isValidator(addr)).to.be.true;
      }
    });

    it("should reject deployment with too few validators", async function () {
      const VoidGateway = await ethers.getContractFactory("VoidGateway");
      const w1 = ethers.Wallet.createRandom();
      await expect(
        VoidGateway.deploy([w1.address], 1)
      ).to.be.revertedWith("Too few validators");
    });

    it("should reject deployment with bad threshold", async function () {
      const VoidGateway = await ethers.getContractFactory("VoidGateway");
      const w1 = ethers.Wallet.createRandom();
      const w2 = ethers.Wallet.createRandom();
      await expect(
        VoidGateway.deploy([w1.address, w2.address], 3)
      ).to.be.revertedWith("Bad threshold");
    });
  });

  describe("sealIntent — native ETH", function () {
    it("should seal a native ETH intent", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      const amount = ethers.parseEther("1");
      const salt = ethers.randomBytes(32);
      const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("recipient"));
      const targetChainId = 137n;

      const commitment = makeCommitment(
        user.address,
        ethers.ZeroAddress,
        amount,
        targetChainId,
        recipientHash,
        ethers.hexlify(salt)
      );

      await expect(
        gateway
          .connect(user)
          .sealIntent(commitment, ethers.ZeroAddress, amount, targetChainId, 60, {
            value: amount,
          })
      )
        .to.emit(gateway, "IntentSealed")
        .withArgs(commitment, ethers.ZeroAddress, targetChainId, 60);

      expect(await gateway.pendingIntents(commitment)).to.be.true;
      expect(await gateway.lockedBalance(ethers.ZeroAddress)).to.equal(amount);
    });

    it("should revert if msg.value does not match amount", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await expect(
        gateway
          .connect(user)
          .sealIntent(commitment, ethers.ZeroAddress, ethers.parseEther("1"), 137, 60, {
            value: ethers.parseEther("0.5"),
          })
      ).to.be.revertedWith("Bad native amount");
    });
  });

  describe("sealIntent — ERC20", function () {
    it("should seal an ERC20 intent", async function () {
      const { gateway, mockToken, user } = await loadFixture(
        deployGatewayFixture
      );

      const amount = ethers.parseUnits("100", 18);
      const tokenAddr = await mockToken.getAddress();
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("erc20-intent"));
      const targetChainId = 137n;

      await mockToken
        .connect(user)
        .approve(await gateway.getAddress(), amount);

      await expect(
        gateway
          .connect(user)
          .sealIntent(commitment, tokenAddr, amount, targetChainId, 60)
      )
        .to.emit(gateway, "IntentSealed")
        .withArgs(commitment, tokenAddr, targetChainId, 60);

      expect(await gateway.pendingIntents(commitment)).to.be.true;
      expect(await gateway.lockedBalance(tokenAddr)).to.equal(amount);
    });

    it("should revert if sending ETH with ERC20 intent", async function () {
      const { gateway, mockToken, user } = await loadFixture(
        deployGatewayFixture
      );

      const tokenAddr = await mockToken.getAddress();
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("bad-erc20"));
      await expect(
        gateway
          .connect(user)
          .sealIntent(commitment, tokenAddr, ethers.parseUnits("100", 18), 137, 60, {
            value: ethers.parseEther("1"),
          })
      ).to.be.revertedWith("Native with ERC20");
    });
  });

  describe("cancelIntent", function () {
    it("should cancel and refund a native ETH intent", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      const amount = ethers.parseEther("2");
      const targetChainId = 137n;
      const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("recipient"));
      const salt = ethers.hexlify(ethers.randomBytes(32));

      const commitment = makeCommitment(
        user.address,
        ethers.ZeroAddress,
        amount,
        targetChainId,
        recipientHash,
        salt
      );

      await gateway
        .connect(user)
        .sealIntent(commitment, ethers.ZeroAddress, amount, targetChainId, 60, {
          value: amount,
        });

      const balanceBefore = await ethers.provider.getBalance(user.address);

      const tx = await gateway
        .connect(user)
        .cancelIntent(ethers.ZeroAddress, amount, targetChainId, recipientHash, salt);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(user.address);
      expect(balanceAfter).to.equal(balanceBefore + amount - gasCost);
      expect(await gateway.pendingIntents(commitment)).to.be.false;
    });

    it("should revert cancel for non-existent intent", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("nobody"));
      const salt = ethers.hexlify(ethers.randomBytes(32));

      await expect(
        gateway
          .connect(user)
          .cancelIntent(ethers.ZeroAddress, ethers.parseEther("1"), 137, recipientHash, salt)
      ).to.be.revertedWith("Not found");
    });
  });

  describe("Duplicate commitment", function () {
    it("should revert on duplicate sealIntent", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      const amount = ethers.parseEther("1");
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("dup"));

      await gateway
        .connect(user)
        .sealIntent(commitment, ethers.ZeroAddress, amount, 137, 60, {
          value: amount,
        });

      await expect(
        gateway
          .connect(user)
          .sealIntent(commitment, ethers.ZeroAddress, amount, 137, 60, {
            value: amount,
          })
      ).to.be.revertedWith("Already sealed");
    });
  });

  describe("Unsupported token", function () {
    it("should revert sealIntent for unsupported token", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      const fakeToken = ethers.Wallet.createRandom().address;
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("unsupported"));

      await expect(
        gateway
          .connect(user)
          .sealIntent(commitment, fakeToken, ethers.parseEther("1"), 137, 60)
      ).to.be.revertedWith("Token not supported");
    });
  });

  describe("settleBatch", function () {
    it("should settle a batch with valid validator signatures", async function () {
      const { gateway, user, recipient, validatorWallets } = await loadFixture(
        deployGatewayFixture
      );

      const amount = ethers.parseEther("1");
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("settle-test"));

      await gateway
        .connect(user)
        .sealIntent(commitment, ethers.ZeroAddress, amount, 137, 60, {
          value: amount,
        });

      const nullifier = ethers.keccak256(ethers.toUtf8Bytes("null-1"));
      const proofHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "address", "address", "uint256"],
          [nullifier, recipient.address, ethers.ZeroAddress, amount]
        )
      );

      const { signers, signatures } = await signProof(
        validatorWallets.slice(0, 2),
        proofHash
      );

      const recipientBalanceBefore = await ethers.provider.getBalance(
        recipient.address
      );

      await expect(
        gateway.settleBatch(
          proofHash,
          [nullifier],
          [recipient.address],
          [ethers.ZeroAddress],
          [amount],
          signers,
          signatures
        )
      )
        .to.emit(gateway, "Released")
        .withArgs(nullifier, recipient.address, ethers.ZeroAddress)
        .and.to.emit(gateway, "BatchSettled");

      const recipientBalanceAfter = await ethers.provider.getBalance(
        recipient.address
      );
      expect(recipientBalanceAfter).to.equal(
        recipientBalanceBefore + amount
      );
    });

    it("should settle a batch with ERC20 tokens", async function () {
      const { gateway, mockToken, user, recipient, validatorWallets } =
        await loadFixture(deployGatewayFixture);

      const amount = ethers.parseUnits("500", 18);
      const tokenAddr = await mockToken.getAddress();
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("settle-erc20"));

      await mockToken
        .connect(user)
        .approve(await gateway.getAddress(), amount);
      await gateway
        .connect(user)
        .sealIntent(commitment, tokenAddr, amount, 137, 60);

      const nullifier = ethers.keccak256(ethers.toUtf8Bytes("null-erc20"));
      const proofHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "address", "address", "uint256"],
          [nullifier, recipient.address, tokenAddr, amount]
        )
      );

      const { signers, signatures } = await signProof(
        validatorWallets.slice(0, 2),
        proofHash
      );

      await gateway.settleBatch(
        proofHash,
        [nullifier],
        [recipient.address],
        [tokenAddr],
        [amount],
        signers,
        signatures
      );

      expect(await mockToken.balanceOf(recipient.address)).to.equal(amount);
    });
  });

  describe("Nullifier replay", function () {
    it("should revert on nullifier replay", async function () {
      const { gateway, user, recipient, validatorWallets } = await loadFixture(
        deployGatewayFixture
      );

      const amount = ethers.parseEther("1");

      const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("replay-1"));
      await gateway
        .connect(user)
        .sealIntent(commitment1, ethers.ZeroAddress, amount, 137, 60, {
          value: amount,
        });

      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("replay-2"));
      await gateway
        .connect(user)
        .sealIntent(commitment2, ethers.ZeroAddress, amount, 137, 60, {
          value: amount,
        });

      const nullifier = ethers.keccak256(ethers.toUtf8Bytes("same-null"));

      const proofHash1 = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "address", "address", "uint256"],
          [nullifier, recipient.address, ethers.ZeroAddress, amount]
        )
      );

      const { signers: s1, signatures: sig1 } = await signProof(
        validatorWallets.slice(0, 2),
        proofHash1
      );

      await gateway.settleBatch(
        proofHash1,
        [nullifier],
        [recipient.address],
        [ethers.ZeroAddress],
        [amount],
        s1,
        sig1
      );

      const proofHash2 = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "address", "address", "uint256", "uint256"],
          [nullifier, recipient.address, ethers.ZeroAddress, amount, 2n]
        )
      );

      const { signers: s2, signatures: sig2 } = await signProof(
        validatorWallets.slice(0, 2),
        proofHash2
      );

      await expect(
        gateway.settleBatch(
          proofHash2,
          [nullifier],
          [recipient.address],
          [ethers.ZeroAddress],
          [amount],
          s2,
          sig2
        )
      ).to.be.revertedWith("Nullifier replayed");
    });
  });

  describe("Access control", function () {
    it("should only allow owner to add validators", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);
      const newValidator = ethers.Wallet.createRandom().address;

      await expect(
        gateway.connect(user).addValidator(newValidator)
      ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
    });

    it("should only allow owner to set supported tokens", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);
      const token = ethers.Wallet.createRandom().address;

      await expect(
        gateway.connect(user).setSupportedToken(token, true)
      ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
    });

    it("should only allow owner to pause/unpause", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      await expect(
        gateway.connect(user).pause()
      ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
    });
  });
});
