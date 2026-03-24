"use client";

import { useState, useCallback } from "react";
import { useWalletClient, usePublicClient } from "wagmi";
import { parseUnits, erc20Abi } from "viem";
import { buildCommitmentHash, generateSalt, getCurrentBatchWindow } from "@/lib/commitment";
import { GATEWAY_ABI, GATEWAY_ADDRESSES, SUPPORTED_TOKENS } from "@/lib/constants";

interface SealParams {
  sourceChainId: number;
  targetChainId: number;
  tokenSymbol: string;
  amount: string;
  recipientAddress: `0x${string}`;
}

export function useSealIntent() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isPending, setIsPending] = useState(false);

  const sealIntent = useCallback(
    async (params: SealParams) => {
      if (!walletClient || !publicClient) {
        throw new Error("Wallet not connected");
      }

      setIsPending(true);

      try {
        const chainId = params.sourceChainId as keyof typeof SUPPORTED_TOKENS;
        const tokens = SUPPORTED_TOKENS[chainId];
        const token = tokens?.find((t) => t.symbol === params.tokenSymbol);
        if (!token) throw new Error(`Token ${params.tokenSymbol} not found on chain ${chainId}`);

        const gateway = GATEWAY_ADDRESSES[chainId];
        if (!gateway || gateway === "0x0000000000000000000000000000000000000000") {
          throw new Error(`No gateway deployed on chain ${chainId} — deploy VoidGateway first`);
        }

        const amount = parseUnits(params.amount, token.decimals);
        const salt = generateSalt();
        const batchWindow = getCurrentBatchWindow();

        const commitmentHash = buildCommitmentHash({
          sender: walletClient.account.address,
          token: token.address,
          amount,
          targetChainId: BigInt(params.targetChainId),
          recipientAddress: params.recipientAddress,
          salt,
        });

        if (!token.native) {
          const allowance = await publicClient.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [walletClient.account.address, gateway],
          });

          if (allowance < amount) {
            const approveHash = await walletClient.writeContract({
              address: token.address,
              abi: erc20Abi,
              functionName: "approve",
              args: [gateway, amount],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }
        }

        const txHash = await walletClient.writeContract({
          address: gateway,
          abi: GATEWAY_ABI,
          functionName: "sealIntent",
          args: [commitmentHash, token.address, amount, BigInt(params.targetChainId), BigInt(batchWindow)],
          value: token.native ? amount : BigInt(0),
        });

        await publicClient.waitForTransactionReceipt({ hash: txHash });

        return { txHash, commitmentHash, salt, batchWindow };
      } finally {
        setIsPending(false);
      }
    },
    [walletClient, publicClient]
  );

  return { sealIntent, isPending };
}
