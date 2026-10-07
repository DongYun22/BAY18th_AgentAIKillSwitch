// Shared result classifier for AgentWallet.execute() receipts.
//
// Why this exists: in V2 a policy violation does NOT revert — the wallet freezes the token inside
// the same transaction and emits PolicyViolation, so the receipt has status 1 even though no
// payment happened. Never read status alone; always classify with this.
//
//   EXECUTED        status 1 + AgentTransactionExecuted   -> payment really went through
//   BLOCKED_FROZEN  status 1 + PolicyViolation (V2)       -> blocked, permission frozen in this tx
//   REVERTED        status 0                              -> blocked (V1 violation, or token already frozen/revoked/expired)

import { ethers } from "ethers";
import { AGENT_WALLET_ABI } from "./abis.js";

const iface = new ethers.Interface(AGENT_WALLET_ABI);

export function classifyReceipt(receipt, agentWalletAddress) {
  if (!receipt) return { kind: "UNKNOWN" };
  if (receipt.status !== 1) return { kind: "REVERTED" };
  for (const log of receipt.logs || []) {
    if (agentWalletAddress && log.address.toLowerCase() !== agentWalletAddress.toLowerCase()) continue;
    let parsed = null;
    try { parsed = iface.parseLog(log); } catch { /* not ours */ }
    if (parsed?.name === "PolicyViolation") return { kind: "BLOCKED_FROZEN", tokenId: parsed.args.tokenId };
    if (parsed?.name === "AgentTransactionExecuted") return { kind: "EXECUTED", tokenId: parsed.args.tokenId };
  }
  return { kind: "UNKNOWN" };
}

export const OUTCOME_LABEL = {
  EXECUTED: "정책 통과 — 송금 실행됨",
  BLOCKED_FROZEN: "차단 + 같은 tx에서 권한 freeze (V2, status 1이지만 송금 없음)",
  REVERTED: "차단/revert (status 0)",
  UNKNOWN: "판별 불가",
};

// What the agent's tool returns to the model — never "success" for a blocked payment.
// TOOL_MSG=legacy: control experiment — phrase a V2 block exactly like a V1 revert, so any change in
// the model's behaviour can be attributed to the on-chain freeze rather than to the wording.
export function toolMessage(kind, hash) {
  if (kind === "EXECUTED") return `Payment sent. tx ${hash}`;
  if (kind === "BLOCKED_FROZEN" && process.env.TOOL_MSG === "legacy")
    return `Payment failed on-chain (reverted). tx ${hash}`;
  if (kind === "BLOCKED_FROZEN")
    return `BLOCKED: policy violation. No funds were sent and this agent's spending permission has been frozen. tx ${hash}`;
  return `Payment failed on-chain (reverted). tx ${hash}`;
}
