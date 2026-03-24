import { ethers, network } from "hardhat";

async function main() {
  console.log(`\nDeploying VoidGateway on network: ${network.name}\n`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  const validator1 = ethers.Wallet.createRandom();
  const validator2 = ethers.Wallet.createRandom();
  const validator3 = ethers.Wallet.createRandom();

  const validatorAddresses = [
    validator1.address,
    validator2.address,
    validator3.address,
  ];
  const threshold = 2;

  console.log("Validator 1:", validator1.address);
  console.log("  Private key:", validator1.privateKey);
  console.log("Validator 2:", validator2.address);
  console.log("  Private key:", validator2.privateKey);
  console.log("Validator 3:", validator3.address);
  console.log("  Private key:", validator3.privateKey);
  console.log("Threshold:", threshold);
  console.log();

  const VoidGateway = await ethers.getContractFactory("VoidGateway");
  const gateway = await VoidGateway.deploy(validatorAddresses, threshold);
  await gateway.waitForDeployment();

  const gatewayAddress = await gateway.getAddress();
  console.log("VoidGateway deployed to:", gatewayAddress);

  const nativeTx = await gateway.setSupportedToken(ethers.ZeroAddress, true);
  await nativeTx.wait();
  console.log("Native token (address(0)) supported: true");

  let testUsdcAddress: string;
  if (network.name === "sepolia") {
    testUsdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  } else if (network.name === "fuji") {
    testUsdcAddress = "0x5425890298aed601595a70AB815c96711a31Bc65";
  } else {
    testUsdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  }

  const usdcTx = await gateway.setSupportedToken(testUsdcAddress, true);
  await usdcTx.wait();
  console.log(`Test USDC (${testUsdcAddress}) supported: true`);

  console.log("\n--- Deployment Summary ---");
  console.log("Network:      ", network.name);
  console.log("Gateway:      ", gatewayAddress);
  console.log("Validators:   ", validatorAddresses);
  console.log("Threshold:    ", threshold);
  console.log("Native token: ", ethers.ZeroAddress);
  console.log("Test USDC:    ", testUsdcAddress);
  console.log("INTENT_TTL:    7 days");
  console.log("--------------------------\n");
  console.log("SAVE THESE VALIDATOR KEYS — you need them for the backend.");
  console.log(`\nUpdate .env:\nGATEWAY_${network.name.toUpperCase()}=${gatewayAddress}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
