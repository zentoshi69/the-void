import { keccak256, encodePacked, encodeAbiParameters, toHex } from "viem";

export function buildCommitmentHash(params: {
  sender: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  targetChainId: bigint;
  recipientAddress: `0x${string}`;
  salt: `0x${string}`;
}): `0x${string}` {
  const recipientHash = keccak256(
    encodePacked(["address"], [params.recipientAddress])
  );
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "bytes32" },
      ],
      [params.sender, params.token, params.amount, params.targetChainId, recipientHash, params.salt]
    )
  );
}

export function generateSalt(): `0x${string}` {
  const random = Math.random().toString() + Date.now().toString();
  return keccak256(toHex(random));
}

export function getCurrentBatchWindow(): number {
  return Math.floor(Date.now() / 25000);
}
