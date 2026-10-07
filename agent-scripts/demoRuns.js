// Two presenter runs for the mock wallet. They change the running QA process
// only when the server calls them. Nothing is broadcast.
//
//   npm run qa
//   npm run demo:existing
//   npm run demo:auto

import { ethers } from "ethers";
import { planWatch } from "./watcher.js";
import { ACTIVE_ID, COLD, HOT, noteCaptured, PERMISSION_TOKEN, UNISWAP } from "./qaFixtures.js";

const AGENT_WALLET = "0x0B26b3d6500E8Cf03189042b3341d5be7774d29F";
const OUTSIDE = "0x00000000000000000000000000000000000000b1";
const FROZEN_ID = 9001n;
const watchLog = [];

const revokeIface = new ethers.Interface(["function revoke(uint256 tokenId)"]);

export function watchEvents() {
  return watchLog;
}

function revoke(tokenId) {
  noteCaptured({
    from: COLD,
    to: PERMISSION_TOKEN,
    data: revokeIface.encodeFunctionData("revoke", [tokenId]),
  });
}

export function runExisting() {
  revoke(FROZEN_ID);
  return [
    "New run 1 — existing agent permissions",
    "Owner revokes the frozen child #9001. That is a kill-switch revoke, not an auto response.",
    "The main wallet's own token allowances stay out of this screen.",
    "The agent still holds WETH for Uniswap. That row stays, with Revoke agent.",
    `Child #${ACTIVE_ID} stays ACTIVE.`,
    "Refresh http://127.0.0.1:5173/?mock=1 and click Connect if the page is waiting.",
    "Next: npm run demo:auto",
  ].join("\n");
}

export function runAuto() {
  const plan = planWatch({
    failedExecute: true,
    logs: [],
    allowlist: [UNISWAP],
    wallet: AGENT_WALLET,
    hot: HOT,
    allowances: {},
    childId: ACTIVE_ID,
  });
  if (!plan.revoke) throw new Error("auto revoke did not plan a revoke");
  revoke(ACTIVE_ID);
  watchLog.push(
    {
      level: "EXEC",
      actor: "Hot Agent",
      detail: `P#${ACTIVE_ID} → ${OUTSIDE} · 0.0001 ETH`,
      note: "target not in allowlist",
      result: "BLOCKED",
      seconds: null,
    },
    {
      level: "KILL",
      actor: "Owner",
      detail: `Permission #${ACTIVE_ID} revoke`,
      note: "",
      result: "REVOKED",
      seconds: 2,
    },
  );
  return [
    "New run 2 — child left the permission",
    `Hot Agent ${HOT}`,
    `execute(#${ACTIVE_ID}) to ${OUTSIDE}`,
    `Allowlist is Uniswap ${UNISWAP}. That target is outside it.`,
    "AgentWallet.execute reverts.",
    `revoke tx: PermissionToken.revoke(${ACTIVE_ID})`,
    "Refresh the page. History shows EXEC BLOCKED, then KILL, auto response 2s.",
  ].join("\n");
}
