import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const VALIDATOR_PRIVATE_KEY =
  process.env.VALIDATOR_PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.SEPOLIA_RPC || "",
      accounts: [VALIDATOR_PRIVATE_KEY],
    },
    fuji: {
      url: process.env.FUJI_RPC || "",
      accounts: [VALIDATOR_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      avalancheFujiTestnet: "snowtrace",
    },
  },
  sourcify: {
    enabled: true,
  },
};

export default config;
