import { expect } from "chai";
import { ethers } from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("VoidGateway", function () {
  async function deployGatewayFixture() {
    const [owner, user, user2, recipient] = await ethers.getSigners();

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
    await mockToken.mint(user2.address, mintAmount);

    return {
      gateway,
      mockToken,
      owner,
      user,
      user2,
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
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "uint256", "bytes32", "bytes32"],
      [sender, token, amount, targetChainId, recipientHash, salt]
    ).then ? "" : ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "uint256", "bytes32", "bytes32"],
        [sender, token, amount, targetChainId, recipientHash, salt]
      )
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

  async function sealNativeIntent(
    gateway: any,
    signer: any,
    amount: bigint,
    targetChainId: bigint,
    batchWindow: number = 60
  ) {
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("recipient"));

    const commitment = makeCommitment(
      signer.address,
      ethers.ZeroAddress,
      amount,
      targetChainId,
      recipientHash,
      salt
    );

    await gateway
      .connect(signer)
      .sealIntent(commitment, ethers.ZeroAddress, amount, targetChainId, batchWindow, {
        value: amount,
      });

    return { commitment, salt, recipientHash };
  }

  // ============================================================
  //  DEPLOYMENT
  // ============================================================

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

    it("should reject deployment with duplicate validators", async function () {
      const VoidGateway = await ethers.getContractFactory("VoidGateway");
      const w1 = ethers.Wallet.createRandom();
      await expect(
        VoidGateway.deploy([w1.address, w1.address], 2)
      ).to.be.revertedWith("Bad validator");
    });

    it("should reject deployment with zero-address validator", async function () {
      const VoidGateway = await ethers.getContractFactory("VoidGateway");
      const w1 = ethers.Wallet.createRandom();
      await expect(
        VoidGateway.deploy([ethers.ZeroAddress, w1.address], 2)
      ).to.be.revertedWith("Bad validator");
    });
  });

  // ============================================================
  //  SEAL INTENT — NATIVE ETH
  // ============================================================

  describe("sealIntent — native ETH", function () {
    it("should seal a native ETH intent", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      const amount = ethers.parseEther("1");
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("recipient"));
      const targetChainId = 137n;

      const commitment = makeCommitment(
        user.address,
        ethers.ZeroAddress,
        amount,
        targetChainId,
        recipientHash,
        salt
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

      const meta = await gateway.intentMeta(commitment);
      expect(meta.depositor).to.equal(user.address);
      expect(meta.token).to.equal(ethers.ZeroAddress);
      expect(meta.amount).to.equal(amount);
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

    it("should revert with zero amount", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("zero"));
      await expect(
        gateway.connect(user).sealIntent(commitment, ethers.ZeroAddress, 0, 137, 60)
      ).to.be.revertedWith("Zero amount");
    });

    it("should revert when targeting same chain", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("samechain"));
      const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
      await expect(
        gateway
          .connect(user)
          .sealIntent(commitment, ethers.ZeroAddress, ethers.parseEther("1"), chainId, 60, {
            value: ethers.parseEther("1"),
          })
      ).to.be.revertedWith("Same chain");
    });

    it("should revert when paused", async function () {
      const { gateway, owner, user } = await loadFixture(deployGatewayFixture);
      await gateway.connect(owner).pause();

      const commitment = ethers.keccak256(ethers.toUtf8Bytes("paused"));
      await expect(
        gateway
          .connect(user)
          .sealIntent(commitment, ethers.ZeroAddress, ethers.parseEther("1"), 137, 60, {
            value: ethers.parseEther("1"),
          })
      ).to.be.revertedWithCustomError(gateway, "EnforcedPause");
    });
  });

  // ============================================================
  //  SEAL INTENT — ERC20
  // ============================================================

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

  // ============================================================
  //  CANCEL INTENT
  // ============================================================

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
        .cancelIntent(commitment, ethers.ZeroAddress, amount, targetChainId, recipientHash, salt);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(user.address);
      expect(balanceAfter).to.equal(balanceBefore + amount - gasCost);
      expect(await gateway.pendingIntents(commitment)).to.be.false;
    });

    it("should emit IntentCancelled event", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      const amount = ethers.parseEther("1");
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

      await expect(
        gateway.connect(user).cancelIntent(commitment, ethers.ZeroAddress, amount, targetChainId, recipientHash, salt)
      )
        .to.emit(gateway, "IntentCancelled")
        .withArgs(commitment, user.address, ethers.ZeroAddress);
    });

    it("should revert cancel for non-existent intent", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("nobody"));
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const fakeCommitment = ethers.keccak256(ethers.toUtf8Bytes("fake"));

      await expect(
        gateway
          .connect(user)
          .cancelIntent(fakeCommitment, ethers.ZeroAddress, ethers.parseEther("1"), 137, recipientHash, salt)
      ).to.be.revertedWith("Not found");
    });

    it("should revert cancel with wrong commitment preimage", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      const amount = ethers.parseEther("1");
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

      const wrongSalt = ethers.hexlify(ethers.randomBytes(32));
      await expect(
        gateway.connect(user).cancelIntent(commitment, ethers.ZeroAddress, amount, targetChainId, recipientHash, wrongSalt)
      ).to.be.revertedWith("Commitment mismatch");
    });

    it("should revert cancel by non-depositor", async function () {
      const { gateway, user, user2 } = await loadFixture(deployGatewayFixture);

      const amount = ethers.parseEther("1");
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

      const attackerCommitment = makeCommitment(
        user2.address,
        ethers.ZeroAddress,
        amount,
        targetChainId,
        recipientHash,
        salt
      );

      // Attacker tries with the real commitment — their derived hash won't match
      await expect(
        gateway.connect(user2).cancelIntent(commitment, ethers.ZeroAddress, amount, targetChainId, recipientHash, salt)
      ).to.be.revertedWith("Commitment mismatch");
    });

    it("should revert cancel when paused", async function () {
      const { gateway, owner, user } = await loadFixture(deployGatewayFixture);

      const amount = ethers.parseEther("1");
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

      await gateway.connect(owner).pause();

      await expect(
        gateway.connect(user).cancelIntent(commitment, ethers.ZeroAddress, amount, targetChainId, recipientHash, salt)
      ).to.be.revertedWithCustomError(gateway, "EnforcedPause");
    });
  });

  // ============================================================
  //  DOUBLE SPEND PROTECTION
  // ============================================================

  describe("Double spend protection", function () {
    it("should prevent cancel after settlement", async function () {
      const { gateway, user, recipient, validatorWallets } = await loadFixture(
        deployGatewayFixture
      );

      const amount = ethers.parseEther("1");
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

      const nullifier = ethers.keccak256(ethers.toUtf8Bytes("null-ds"));
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

      await gateway.settleBatch(
        proofHash,
        [commitment],
        [nullifier],
        [recipient.address],
        [ethers.ZeroAddress],
        [amount],
        signers,
        signatures
      );

      expect(await gateway.pendingIntents(commitment)).to.be.false;
      expect(await gateway.settledCommitments(commitment)).to.be.true;

      await expect(
        gateway.connect(user).cancelIntent(commitment, ethers.ZeroAddress, amount, targetChainId, recipientHash, salt)
      ).to.be.revertedWith("Not found");
    });
  });

  // ============================================================
  //  DUPLICATE COMMITMENT
  // ============================================================

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

  // ============================================================
  //  UNSUPPORTED TOKEN
  // ============================================================

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

  // ============================================================
  //  SETTLE BATCH
  // ============================================================

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
          [commitment],
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
        [commitment],
        [nullifier],
        [recipient.address],
        [tokenAddr],
        [amount],
        signers,
        signatures
      );

      expect(await mockToken.balanceOf(recipient.address)).to.equal(amount);
    });

    it("should revert with zero release amount", async function () {
      const { gateway, user, recipient, validatorWallets } = await loadFixture(
        deployGatewayFixture
      );

      const amount = ethers.parseEther("1");
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("zero-release"));

      await gateway
        .connect(user)
        .sealIntent(commitment, ethers.ZeroAddress, amount, 137, 60, {
          value: amount,
        });

      const nullifier = ethers.keccak256(ethers.toUtf8Bytes("null-z"));
      const proofHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "address", "address", "uint256"],
          [nullifier, recipient.address, ethers.ZeroAddress, 0n]
        )
      );

      const { signers, signatures } = await signProof(
        validatorWallets.slice(0, 2),
        proofHash
      );

      await expect(
        gateway.settleBatch(
          proofHash,
          [commitment],
          [nullifier],
          [recipient.address],
          [ethers.ZeroAddress],
          [0],
          signers,
          signatures
        )
      ).to.be.revertedWith("Zero release amount");
    });

    it("should revert settlement of non-pending intent", async function () {
      const { gateway, user, recipient, validatorWallets } = await loadFixture(
        deployGatewayFixture
      );

      const fakeCommitment = ethers.keccak256(ethers.toUtf8Bytes("not-sealed"));
      const nullifier = ethers.keccak256(ethers.toUtf8Bytes("null-fake"));
      const amount = ethers.parseEther("1");

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

      await expect(
        gateway.settleBatch(
          proofHash,
          [fakeCommitment],
          [nullifier],
          [recipient.address],
          [ethers.ZeroAddress],
          [amount],
          signers,
          signatures
        )
      ).to.be.revertedWith("Intent not pending");
    });
  });

  // ============================================================
  //  NULLIFIER REPLAY
  // ============================================================

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
        [commitment1],
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
          [commitment2],
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

  // ============================================================
  //  RESCUE EXPIRED INTENT
  // ============================================================

  describe("rescueExpiredIntent", function () {
    it("should rescue an expired intent after TTL", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      const amount = ethers.parseEther("1");
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("expire-test"));

      await gateway
        .connect(user)
        .sealIntent(commitment, ethers.ZeroAddress, amount, 137, 60, {
          value: amount,
        });

      await time.increase(7 * 24 * 60 * 60 + 1);

      const balanceBefore = await ethers.provider.getBalance(user.address);

      const tx = await gateway.connect(user).rescueExpiredIntent(commitment);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(user.address);
      expect(balanceAfter).to.equal(balanceBefore + amount - gasCost);
      expect(await gateway.pendingIntents(commitment)).to.be.false;
    });

    it("should revert rescue before TTL expires", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      const amount = ethers.parseEther("1");
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("early-rescue"));

      await gateway
        .connect(user)
        .sealIntent(commitment, ethers.ZeroAddress, amount, 137, 60, {
          value: amount,
        });

      await expect(
        gateway.connect(user).rescueExpiredIntent(commitment)
      ).to.be.revertedWith("Not expired");
    });

    it("should revert rescue by non-depositor", async function () {
      const { gateway, user, user2 } = await loadFixture(deployGatewayFixture);

      const amount = ethers.parseEther("1");
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("not-yours"));

      await gateway
        .connect(user)
        .sealIntent(commitment, ethers.ZeroAddress, amount, 137, 60, {
          value: amount,
        });

      await time.increase(7 * 24 * 60 * 60 + 1);

      await expect(
        gateway.connect(user2).rescueExpiredIntent(commitment)
      ).to.be.revertedWith("Not depositor");
    });
  });

  // ============================================================
  //  VALIDATOR MANAGEMENT
  // ============================================================

  describe("Validator management", function () {
    it("should only allow owner to add validators", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);
      const newValidator = ethers.Wallet.createRandom().address;

      await expect(
        gateway.connect(user).addValidator(newValidator)
      ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
    });

    it("should add a validator and emit event", async function () {
      const { gateway, owner } = await loadFixture(deployGatewayFixture);
      const newValidator = ethers.Wallet.createRandom().address;

      await expect(gateway.connect(owner).addValidator(newValidator))
        .to.emit(gateway, "ValidatorAdded")
        .withArgs(newValidator);

      expect(await gateway.isValidator(newValidator)).to.be.true;
      expect(await gateway.validatorCount()).to.equal(4);
    });

    it("should remove a validator and emit event", async function () {
      const { gateway, owner, validatorAddresses } = await loadFixture(
        deployGatewayFixture
      );

      const extra = ethers.Wallet.createRandom().address;
      await gateway.connect(owner).addValidator(extra);

      await expect(gateway.connect(owner).removeValidator(validatorAddresses[0]))
        .to.emit(gateway, "ValidatorRemoved")
        .withArgs(validatorAddresses[0]);

      expect(await gateway.isValidator(validatorAddresses[0])).to.be.false;
      expect(await gateway.validatorCount()).to.equal(3);
    });

    it("should revert removing validator if it drops below threshold", async function () {
      const { gateway, owner, validatorAddresses } = await loadFixture(
        deployGatewayFixture
      );

      await gateway.connect(owner).removeValidator(validatorAddresses[0]);
      await expect(
        gateway.connect(owner).removeValidator(validatorAddresses[1])
      ).to.be.revertedWith("Below threshold");
    });
  });

  // ============================================================
  //  ACCESS CONTROL
  // ============================================================

  describe("Access control", function () {
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

    it("should only allow owner to set threshold", async function () {
      const { gateway, user } = await loadFixture(deployGatewayFixture);

      await expect(
        gateway.connect(user).setThreshold(3)
      ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
    });
  });

  // ============================================================
  //  SIGNATURE VALIDATION
  // ============================================================

  describe("Signature validation", function () {
    it("should reject unsorted signers", async function () {
      const { gateway, user, recipient, validatorWallets } = await loadFixture(
        deployGatewayFixture
      );

      const amount = ethers.parseEther("1");
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("sig-test"));

      await gateway
        .connect(user)
        .sealIntent(commitment, ethers.ZeroAddress, amount, 137, 60, {
          value: amount,
        });

      const nullifier = ethers.keccak256(ethers.toUtf8Bytes("null-sig"));
      const proofHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "address", "address", "uint256"],
          [nullifier, recipient.address, ethers.ZeroAddress, amount]
        )
      );

      const reversed = [...validatorWallets.slice(0, 2)].reverse();
      const signers: string[] = [];
      const signatures: string[] = [];

      for (const w of reversed) {
        signers.push(w.address);
        signatures.push(await w.signMessage(ethers.getBytes(proofHash)));
      }

      // Only reject if they're actually unsorted
      const isSorted = signers[0].toLowerCase() < signers[1].toLowerCase();
      if (!isSorted) {
        await expect(
          gateway.settleBatch(
            proofHash,
            [commitment],
            [nullifier],
            [recipient.address],
            [ethers.ZeroAddress],
            [amount],
            signers,
            signatures
          )
        ).to.be.revertedWith("Not sorted");
      }
    });

    it("should reject non-validator signer", async function () {
      const { gateway, user, recipient } = await loadFixture(
        deployGatewayFixture
      );

      const amount = ethers.parseEther("1");
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("fake-val"));

      await gateway
        .connect(user)
        .sealIntent(commitment, ethers.ZeroAddress, amount, 137, 60, {
          value: amount,
        });

      const nullifier = ethers.keccak256(ethers.toUtf8Bytes("null-fv"));
      const proofHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "address", "address", "uint256"],
          [nullifier, recipient.address, ethers.ZeroAddress, amount]
        )
      );

      const fake1 = ethers.Wallet.createRandom();
      const fake2 = ethers.Wallet.createRandom();
      const sorted = [fake1, fake2].sort((a, b) =>
        a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1
      );

      const signers = sorted.map((w) => w.address);
      const sigs = await Promise.all(
        sorted.map((w) => w.signMessage(ethers.getBytes(proofHash)))
      );

      await expect(
        gateway.settleBatch(
          proofHash,
          [commitment],
          [nullifier],
          [recipient.address],
          [ethers.ZeroAddress],
          [amount],
          signers,
          sigs
        )
      ).to.be.revertedWith("Not validator");
    });
  });
});
