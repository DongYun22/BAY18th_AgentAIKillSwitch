// Mock Agent — malicious / policy-violating transaction. Simulates a compromised or
// misbehaving Hot Agent attempting to pay a target that is NOT in its allowlist.
//
// Important: we pass an explicit gasLimit so ethers skips its normal "simulate first"
// behavior (which would otherwise refuse to even broadcast a call it can tell will revert).
// Forcing the broadcast means the attempt actually lands on-chain as a *failed* transaction
// (status 0) — which is exactly what watcher.js is watching for. Without this, the rejection
// would happen entirely client-side and there would be nothing on-chain for the watcher to see.
//
// Required env vars:
//   HOT_AGENT_PRIVATE_KEY   - the Hot Agent's own private key (from `cast wallet new`)
//   AGENT_WALLET_ADDRESS    - from deployments.json
// Optional:
//   RPC_URL

import { ethers } from "ethers";
import fs from "fs";
import { AGENT_WALLET_ABI } from "./abis.js";
import { classifyReceipt, OUTCOME_LABEL } from "./outcome.js";

const RPC_URL = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const HOT_AGENT_PRIVATE_KEY = process.env.HOT_AGENT_PRIVATE_KEY;
const AGENT_WALLET_ADDRESS = process.env.AGENT_WALLET_ADDRESS;

if (!HOT_AGENT_PRIVATE_KEY || !AGENT_WALLET_ADDRESS) {
  console.error("필요한 환경변수가 없습니다: HOT_AGENT_PRIVATE_KEY, AGENT_WALLET_ADDRESS");
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync("state.json", "utf8"));

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const hotAgent = new ethers.Wallet(HOT_AGENT_PRIVATE_KEY, provider);
  const agentWallet = new ethers.Contract(AGENT_WALLET_ADDRESS, AGENT_WALLET_ABI, hotAgent);

  console.log("[Mock Agent] 악의적/정책위반 트랜잭션 시도");
  console.log("  childId:", state.childId, " -> 허용되지 않은 주소:", state.attackerTarget);

  try {
    const tx = await agentWallet.execute(
      state.childId,
      state.attackerTarget,
      ethers.parseEther("0.0003"),
      "0x",
      { gasLimit: 300000 } // force broadcast even though PermissionToken.checkPolicy() will fail
    );
    console.log("  tx 전송됨:", tx.hash);
    const receipt = await tx.wait().catch((e) => e.receipt); // ethers v6 throws on status 0 too
    const { kind } = classifyReceipt(receipt, AGENT_WALLET_ADDRESS);
    console.log(`  온체인 결과 status=${receipt?.status} → ${OUTCOME_LABEL[kind]}`);
  } catch (e) {
    console.log("  전송 단계에서부터 차단됨:", e.shortMessage || e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
