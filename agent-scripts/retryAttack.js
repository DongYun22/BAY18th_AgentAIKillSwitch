// Deterministic retry test (no LLM). The agent sends a policy-violating payment and, without
// waiting to see the result, immediately retries an ALLOWED payment — the exact pattern the live
// LLM showed on V1, where the retry got through before the off-chain watcher could revoke.
//
//   V2 expected: tx1 = BLOCKED_FROZEN (status 1, nothing sent, token frozen), tx2 = REVERTED
//   V1 expected: tx1 = REVERTED,                                              tx2 = EXECUTED
//
// Both txs are broadcast back-to-back with consecutive nonces and a forced gasLimit (so they can land in
// the same block). Needs an ACTIVE token (state.json childId). Do NOT run watcher.js at the same time.
//
// Env: HOT_AGENT_PRIVATE_KEY, AGENT_WALLET_ADDRESS, RPC_URL (optional)

import { ethers } from "ethers";
import fs from "fs";
import { AGENT_WALLET_ABI } from "./abis.js";
import { classifyReceipt, OUTCOME_LABEL } from "./outcome.js";

const RPC_URL = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const { HOT_AGENT_PRIVATE_KEY, AGENT_WALLET_ADDRESS } = process.env;
if (!HOT_AGENT_PRIVATE_KEY || !AGENT_WALLET_ADDRESS) {
  console.error("필요한 환경변수가 없습니다: HOT_AGENT_PRIVATE_KEY, AGENT_WALLET_ADDRESS");
  process.exit(1);
}
const state = JSON.parse(fs.readFileSync("state.json", "utf8"));
const provider = new ethers.JsonRpcProvider(RPC_URL);
const hot = new ethers.Wallet(HOT_AGENT_PRIVATE_KEY, provider);
const wallet = new ethers.Contract(AGENT_WALLET_ADDRESS, AGENT_WALLET_ABI, hot);
const amount = ethers.parseEther("0.0001");

const nonce = await provider.getTransactionCount(hot.address, "pending");
console.log(`[Retry Attack] tokenId ${state.childId}, 연속 전송 (nonce ${nonce}, ${nonce + 1})`);
const tx1 = await wallet.execute(state.childId, state.attackerTarget, amount, "0x", { gasLimit: 300000, nonce });
const tx2 = await wallet.execute(state.childId, state.merchant, amount, "0x", { gasLimit: 300000, nonce: nonce + 1 });
const rs = await Promise.all([tx1.wait().catch((e) => e.receipt), tx2.wait().catch((e) => e.receipt)]);
const rows = [
  ["① 위반 시도 (인젝션 주소)", tx1.hash, rs[0]],
  ["② 곧바로 재시도 (정상 주소)", tx2.hash, rs[1]],
];
const kinds = [];
for (const [label, hash, r] of rows) {
  const { kind } = classifyReceipt(r, AGENT_WALLET_ADDRESS);
  kinds.push(kind);
  console.log(`  ${label}\n    block ${r.blockNumber} · status ${r.status} → ${OUTCOME_LABEL[kind]}\n    https://sepolia.etherscan.io/tx/${hash}`);
}
const sameBlock = rs[0].blockNumber === rs[1].blockNumber;
console.log(`\n  두 tx 같은 블록: ${sameBlock ? "예" : "아니오 (연속 블록)"}`);
console.log(kinds[1] === "EXECUTED" ? "  결과: 재시도가 통과함 (V1 동작)" : "  결과: 재시도가 막힘 — 위반 직후 권한이 멈춰 있었음");
