// One-time setup: Cold mints a root PermissionToken to itself, then delegates a narrower
// child PermissionToken to the Hot Agent's execution address. Run this once before the
// mock-agent / watcher scripts. Writes the resulting token ids to state.json so the other
// scripts don't need to re-derive them.
//
// Required env vars:
//   COLD_PRIVATE_KEY          - the deployer/owner wallet's private key (same one used to deploy)
//   HOT_AGENT_ADDRESS         - address of the Hot Agent identity (from `cast wallet new`, no key needed here)
//   PERMISSION_TOKEN_ADDRESS  - from deployments.json
// Optional:
//   RPC_URL                   - defaults to the public Ethereum Sepolia RPC used for deployment

import { ethers } from "ethers";
import fs from "fs";
import { PERMISSION_TOKEN_ABI } from "./abis.js";

const RPC_URL = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const COLD_PRIVATE_KEY = process.env.COLD_PRIVATE_KEY;
const HOT_AGENT_ADDRESS = process.env.HOT_AGENT_ADDRESS;
const PERMISSION_TOKEN_ADDRESS = process.env.PERMISSION_TOKEN_ADDRESS;
// V2: register AgentWallet as this tree's guardian so it can freeze on a violation in the same tx.
// Set GUARDIAN=0 to skip (V1 behaviour: violations just revert).
const AGENT_WALLET_ADDRESS = process.env.AGENT_WALLET_ADDRESS;
const USE_GUARDIAN = process.env.GUARDIAN !== "0";

// Demo-only placeholder addresses — never funded/controlled, just used as `target` values so
// the allowlist check has something concrete to allow or reject. A call with empty calldata
// to either is a no-op plain ETH transfer attempt from AgentWallet's own balance.
const MERCHANT_ADDRESS = "0x000000000000000000000000000000000000dEaD"; // in the allowlist
const ATTACKER_TARGET = "0x000000000000000000000000000000000000bEEF"; // NOT in the allowlist

if (!COLD_PRIVATE_KEY || !HOT_AGENT_ADDRESS || !PERMISSION_TOKEN_ADDRESS) {
  console.error(
    "필요한 환경변수가 없습니다: COLD_PRIVATE_KEY, HOT_AGENT_ADDRESS, PERMISSION_TOKEN_ADDRESS"
  );
  process.exit(1);
}

function extractTokenId(contract, receipt) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "PermissionMinted") {
        return parsed.args.tokenId;
      }
    } catch {
      // not a log from this contract/interface — skip
    }
  }
  throw new Error("PermissionMinted 이벤트를 트랜잭션 로그에서 찾지 못했습니다.");
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const cold = new ethers.Wallet(COLD_PRIVATE_KEY, provider);
  const permissionToken = new ethers.Contract(PERMISSION_TOKEN_ADDRESS, PERMISSION_TOKEN_ABI, cold);

  console.log("Cold (owner):", cold.address);
  console.log("Hot Agent:   ", HOT_AGENT_ADDRESS);

  // 1) Root token — Cold's own top-level permission.
  const rootPolicy = {
    spendingLimit: ethers.parseEther("0.003"),
    allowlist: [MERCHANT_ADDRESS],
    expiry: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  };
  console.log("\n[1/3] Root 토큰 발급 중...");
  let tx = await permissionToken.mintRoot(rootPolicy);
  console.log("  tx:", tx.hash);
  let receipt = await tx.wait();
  const rootId = extractTokenId(permissionToken, receipt);
  console.log("  Root tokenId:", rootId.toString());

  // 1.5) V2 guardian — AgentWallet may freeze tokens of this tree on a policy violation.
  let guardian = null;
  console.log("\n[2/3] Guardian 등록 (V2 온체인 즉시 정지)...");
  if (!USE_GUARDIAN) {
    console.log("  GUARDIAN=0 — 건너뜀 (V1 동작: 위반 시 revert만)");
  } else if (!AGENT_WALLET_ADDRESS) {
    console.log("  AGENT_WALLET_ADDRESS가 없어 건너뜀");
  } else {
    try {
      tx = await permissionToken.setGuardian(rootId, AGENT_WALLET_ADDRESS);
      console.log("  tx:", tx.hash);
      await tx.wait();
      guardian = AGENT_WALLET_ADDRESS;
      console.log("  guardian:", guardian);
    } catch (e) {
      console.log("  등록 실패 — V1 컨트랙트일 수 있습니다 (setGuardian 없음):", e.shortMessage || e.message);
    }
  }

  // 2) Child token — narrower policy, delegated to the Hot Agent address.
  const childPolicy = {
    spendingLimit: ethers.parseEther("0.0008"),
    allowlist: [MERCHANT_ADDRESS],
    expiry: Math.floor(Date.now() / 1000) + 1 * 24 * 3600,
  };
  console.log("\n[3/3] Child 토큰 발급 중 (Hot Agent에게 위임)...");
  tx = await permissionToken.mintChild(HOT_AGENT_ADDRESS, rootId, childPolicy);
  console.log("  tx:", tx.hash);
  receipt = await tx.wait();
  const childId = extractTokenId(permissionToken, receipt);
  console.log("  Child tokenId:", childId.toString());

  const state = {
    rootId: rootId.toString(),
    childId: childId.toString(),
    hotAgent: HOT_AGENT_ADDRESS,
    merchant: MERCHANT_ADDRESS,
    attackerTarget: ATTACKER_TARGET,
    guardian,
  };
  fs.writeFileSync("state.json", JSON.stringify(state, null, 2));
  console.log("\nstate.json 저장 완료:", state);
}

main().catch((e) => {
  console.error("setup 실패:", e.shortMessage || e.message || e);
  process.exit(1);
});
