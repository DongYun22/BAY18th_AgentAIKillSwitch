// Mock Agent — normal transaction. Simulates the Hot Agent identity making a small payment
// that is fully inside its delegated policy (allowlisted target, under the spending limit).
// This should succeed on-chain.
//
// Required env vars:
//   HOT_AGENT_PRIVATE_KEY   - the Hot Agent's own private key (from `cast wallet new`)
//   AGENT_WALLET_ADDRESS    - from deployments.json
// Optional:
//   RPC_URL

import { ethers } from "ethers";
import fs from "fs";
import { AGENT_WALLET_ABI } from "./abis.js";

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

  console.log("[Mock Agent] 정상 트랜잭션 시도");
  console.log("  childId:", state.childId, " -> merchant:", state.merchant);

  const tx = await agentWallet.execute(state.childId, state.merchant, ethers.parseEther("0.0003"), "0x");
  console.log("  tx 전송됨:", tx.hash);
  const receipt = await tx.wait();
  console.log("  성공! status:", receipt.status, " block:", receipt.blockNumber);
}

main().catch((e) => {
  console.error("실패 (정상 tx인데 실패하면 정책/잔액을 확인하세요):", e.shortMessage || e.message || e);
  process.exit(1);
});
