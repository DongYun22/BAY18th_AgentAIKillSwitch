// Kill-switch watcher. Polls new blocks for transactions sent by the Hot Agent address to
// AgentWallet. If one of them reverted on-chain (status 0 — i.e. PermissionToken.checkPolicy()
// rejected it), that's treated as a suspicious/malicious attempt, and the watcher immediately
// calls PermissionToken.revoke() on that child token using Cold's key — permanently burning it
// so the Hot Agent can never execute anything with it again, even if the underlying key or
// prompt-injection vector is still compromised.
//
// This is the actual "kill switch": the per-transaction policy check in the contracts already
// blocks any individual out-of-policy call, but the watcher is what escalates a single blocked
// attempt into "this agent's capability is revoked entirely."
//
// Required env vars:
//   COLD_PRIVATE_KEY          - Cold's private key (only Cold/the parent-token owner can revoke)
//   PERMISSION_TOKEN_ADDRESS  - from deployments.json
//   AGENT_WALLET_ADDRESS      - from deployments.json
// Optional:
//   RPC_URL
//   POLL_INTERVAL_MS          - default 5000

import { ethers } from "ethers";
import fs from "fs";
import { PERMISSION_TOKEN_ABI } from "./abis.js";

const RPC_URL = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const COLD_PRIVATE_KEY = process.env.COLD_PRIVATE_KEY;
const PERMISSION_TOKEN_ADDRESS = process.env.PERMISSION_TOKEN_ADDRESS;
const AGENT_WALLET_ADDRESS = process.env.AGENT_WALLET_ADDRESS;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);

if (!COLD_PRIVATE_KEY || !PERMISSION_TOKEN_ADDRESS || !AGENT_WALLET_ADDRESS) {
  console.error(
    "필요한 환경변수가 없습니다: COLD_PRIVATE_KEY, PERMISSION_TOKEN_ADDRESS, AGENT_WALLET_ADDRESS"
  );
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync("state.json", "utf8"));

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const cold = new ethers.Wallet(COLD_PRIVATE_KEY, provider);
  const permissionToken = new ethers.Contract(PERMISSION_TOKEN_ADDRESS, PERMISSION_TOKEN_ABI, cold);

  console.log("[Watcher] 감시 시작");
  console.log("  AgentWallet:", AGENT_WALLET_ADDRESS);
  console.log("  Hot Agent:  ", state.hotAgent);
  console.log("  감시 대상 childId:", state.childId);
  console.log(`  ${POLL_INTERVAL_MS}ms 간격으로 새 블록을 폴링합니다. (Ctrl+C로 종료)\n`);

  let lastBlock = await provider.getBlockNumber();
  let revoked = false;

  setInterval(async () => {
    if (revoked) return;
    try {
      const current = await provider.getBlockNumber();
      if (current <= lastBlock) return;

      for (let bn = lastBlock + 1; bn <= current; bn++) {
        const block = await provider.getBlock(bn);
        if (!block) continue;

        for (const txHash of block.transactions) {
          const tx = await provider.getTransaction(txHash);
          if (!tx || !tx.from || !tx.to) continue;
          const isFromHotAgent = tx.from.toLowerCase() === state.hotAgent.toLowerCase();
          const isToAgentWallet = tx.to.toLowerCase() === AGENT_WALLET_ADDRESS.toLowerCase();
          if (!isFromHotAgent || !isToAgentWallet) continue;

          const receipt = await provider.getTransactionReceipt(txHash);
          if (!receipt) continue;

          if (receipt.status === 1) {
            console.log(`[Watcher] 정상 실행 확인 (block ${bn}):`, txHash);
          } else {
            console.log(`[Watcher] ⚠ 의심스러운(실패한) 트랜잭션 감지 (block ${bn}):`, txHash);
            revoked = true;
            console.log(`[Watcher] childId ${state.childId} 즉시 revoke 실행...`);
            const rtx = await permissionToken.revoke(state.childId);
            console.log("  revoke tx:", rtx.hash);
            const rreceipt = await rtx.wait();
            console.log("[Watcher] revoke 완료. status:", rreceipt.status);
            console.log("[Watcher] 이 childId로는 이제 AgentWallet.execute()가 항상 실패합니다.");
          }
        }
      }
      lastBlock = current;
    } catch (e) {
      console.error("[Watcher] 폴링 중 에러:", e.shortMessage || e.message || e);
    }
  }, POLL_INTERVAL_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
