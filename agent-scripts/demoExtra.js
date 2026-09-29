// Extra on-chain demo: runs the three features that so far were only proven in local
// `forge test`, but this time against the real contracts on Ethereum Sepolia, so every step
// leaves a tx hash on Etherscan.
//
//   A. Attenuation enforcement  — Cold tries to mint a child WIDER than its parent -> rejected on-chain
//   B. Freeze / unfreeze        — execution works, is blocked while frozen, works again after unfreeze
//   C. Cascading revoke         — Cold -> Hot -> Sub-agent chain; revoking the middle token kills the grandchild
//
// IMPORTANT: stop watcher.js before running this. Step B intentionally produces a failed
// execution while frozen, and the watcher would treat that as an attack and revoke the token.
//
// Required env vars (same as the other scripts):
//   COLD_PRIVATE_KEY, HOT_AGENT_PRIVATE_KEY, PERMISSION_TOKEN_ADDRESS, AGENT_WALLET_ADDRESS
// Optional: RPC_URL
// Requires state.json from setup.js (uses its rootId as the parent for everything here).

import { ethers } from "ethers";
import fs from "fs";
import { PERMISSION_TOKEN_ABI, AGENT_WALLET_ABI } from "./abis.js";

const RPC_URL = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const { COLD_PRIVATE_KEY, HOT_AGENT_PRIVATE_KEY, PERMISSION_TOKEN_ADDRESS, AGENT_WALLET_ADDRESS } = process.env;

if (!COLD_PRIVATE_KEY || !HOT_AGENT_PRIVATE_KEY || !PERMISSION_TOKEN_ADDRESS || !AGENT_WALLET_ADDRESS) {
  console.error(
    "필요한 환경변수가 없습니다: COLD_PRIVATE_KEY, HOT_AGENT_PRIVATE_KEY, PERMISSION_TOKEN_ADDRESS, AGENT_WALLET_ADDRESS"
  );
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync("state.json", "utf8"));
const ETHERSCAN = "https://sepolia.etherscan.io/tx/";
const FORCE = { gasLimit: 400000 }; // skip client-side simulation so expected failures still land on-chain
const results = [];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const cold = new ethers.Wallet(COLD_PRIVATE_KEY, provider);
const hot = new ethers.Wallet(HOT_AGENT_PRIVATE_KEY, provider);
const tokenAsCold = new ethers.Contract(PERMISSION_TOKEN_ADDRESS, PERMISSION_TOKEN_ABI, cold);
const tokenAsHot = new ethers.Contract(PERMISSION_TOKEN_ADDRESS, PERMISSION_TOKEN_ABI, hot);
const walletAsHot = new ethers.Contract(AGENT_WALLET_ADDRESS, AGENT_WALLET_ABI, hot);

const now = () => Math.floor(Date.now() / 1000);
const policy = (limitEth, allowlist, seconds) => ({
  spendingLimit: ethers.parseEther(limitEth),
  allowlist,
  expiry: now() + seconds,
});

function extractTokenId(receipt) {
  for (const log of receipt.logs) {
    try {
      const parsed = tokenAsCold.interface.parseLog(log);
      if (parsed?.name === "PermissionMinted") return parsed.args.tokenId;
    } catch {
      // not ours
    }
  }
  throw new Error("PermissionMinted 이벤트를 찾지 못했습니다.");
}

// Send a tx that is expected to succeed; record it.
async function expectOk(step, label, sendFn) {
  const tx = await sendFn();
  const receipt = await tx.wait();
  console.log(`  [OK]      ${label}\n            ${ETHERSCAN}${tx.hash}`);
  results.push({ step, label, expected: "success", status: receipt.status, tx: tx.hash });
  return receipt;
}

// Send a tx that is expected to revert. First simulate it to learn the revert reason by name,
// then force-broadcast it so the failure is recorded on-chain with a tx hash.
async function expectRevert(step, label, simulateFn, sendFn) {
  let reason = "(unknown)";
  try {
    await simulateFn();
    reason = "(시뮬레이션에서 통과함 — 예상과 다름)";
  } catch (e) {
    reason = e.revert?.name || e.shortMessage || e.message;
  }
  const tx = await sendFn();
  const receipt = await tx.wait().catch((e) => e.receipt);
  const status = receipt?.status;
  const tag = status === 0 ? "[REVERTED]" : "[!! 예상과 다름]";
  console.log(`  ${tag} ${label}  (reason: ${reason})\n            ${ETHERSCAN}${tx.hash}`);
  results.push({ step, label, expected: "revert", status, reason, tx: tx.hash });
}

async function mintChild(ownerToken, step, label, to, parentId, pol) {
  const receipt = await expectOk(step, label, () => ownerToken.mintChild(to, parentId, pol));
  return extractTokenId(receipt);
}

async function main() {
  const rootId = BigInt(state.rootId);
  const merchant = state.merchant;
  console.log("Cold:", cold.address);
  console.log("Hot: ", hot.address);
  console.log("Root tokenId:", rootId.toString(), " valid:", await tokenAsCold.isValid(rootId));
  if (!(await tokenAsCold.isValid(rootId))) {
    throw new Error("root 토큰이 유효하지 않습니다(만료 등). setup.js를 다시 실행하세요.");
  }

  // ---------------------------------------------------------------- A
  console.log("\n[A] Attenuation — 부모보다 넓은 권한 발급 시도 (root 한도 0.003 ETH)");
  const widerPolicy = policy("0.01", [merchant], 3600); // 0.01 > parent's 0.003
  await expectRevert(
    "A",
    "mintChild(한도 0.01 ETH > 부모 0.003 ETH)",
    () => tokenAsCold.mintChild.staticCall(hot.address, rootId, widerPolicy),
    () => tokenAsCold.mintChild(hot.address, rootId, widerPolicy, FORCE)
  );

  // ---------------------------------------------------------------- B
  console.log("\n[B] Freeze / Unfreeze — 일시 정지 후 복구");
  const childB = await mintChild(tokenAsCold, "B", "Hot Agent에게 child 발급", hot.address, rootId, policy("0.0008", [merchant], 86400));
  console.log(`            child tokenId: ${childB}`);
  const pay = ethers.parseEther("0.0001");

  await expectOk("B", `execute(token ${childB}) — freeze 전`, () => walletAsHot.execute(childB, merchant, pay, "0x"));
  await expectOk("B", `freeze(token ${childB}) by Cold`, () => tokenAsCold.freeze(childB));
  await expectRevert(
    "B",
    `execute(token ${childB}) — freeze 중`,
    () => walletAsHot.execute.staticCall(childB, merchant, pay, "0x"),
    () => walletAsHot.execute(childB, merchant, pay, "0x", FORCE)
  );
  await expectOk("B", `unfreeze(token ${childB}) by Cold`, () => tokenAsCold.unfreeze(childB));
  await expectOk("B", `execute(token ${childB}) — unfreeze 후`, () => walletAsHot.execute(childB, merchant, pay, "0x"));

  // ---------------------------------------------------------------- C
  console.log("\n[C] Cascading revoke — Cold → Hot → Sub-agent, 중간 토큰 revoke");
  const subAgent = ethers.Wallet.createRandom().address; // only needs to hold the token, never signs
  const childC = await mintChild(tokenAsCold, "C", "Cold → Hot: child 발급", hot.address, rootId, policy("0.0008", [merchant], 86400));
  const grandC = await mintChild(tokenAsHot, "C", "Hot → Sub-agent: grandchild 재위임", subAgent, childC, policy("0.0002", [merchant], 3600));
  console.log(`            child ${childC} (Hot) → grandchild ${grandC} (Sub-agent ${subAgent})`);
  console.log(`            revoke 전 isValid: child=${await tokenAsCold.isValid(childC)}, grandchild=${await tokenAsCold.isValid(grandC)}`);

  await expectOk("C", `revoke(token ${childC}) by Cold`, () => tokenAsCold.revoke(childC));
  const childValid = await tokenAsCold.isValid(childC);
  const grandValid = await tokenAsCold.isValid(grandC);
  console.log(`            revoke 후 isValid: child=${childValid}, grandchild=${grandValid}`);
  results.push({ step: "C", label: "revoke 후 isValid(child, grandchild)", child: childValid, grandchild: grandValid });
  if (!childValid && !grandValid) {
    console.log("  [OK]      Cold가 grandchild를 직접 건드리지 않았는데도 함께 무효화됨 (연쇄 회수)");
  } else {
    console.log("  [!! 예상과 다름] 연쇄 회수가 확인되지 않음");
  }

  fs.writeFileSync("demo-extra-results.json", JSON.stringify(results, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  console.log("\n결과를 demo-extra-results.json에 저장했습니다.");
}

main().catch((e) => {
  console.error("\n실패:", e.shortMessage || e.message || e);
  process.exit(1);
});
