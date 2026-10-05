import assert from "node:assert/strict";
import { test } from "node:test";
import { planWatch } from "./watcher.js";

const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const wallet = "0x0B26b3d6500E8Cf03189042b3341d5be7774d29F";
const hot = "0x67f49213ae30080250467bbc2fc9495f9c58dca8";
const token = "0x0000000000000000000000000000000000000002";
const spender = "0x0000000000000000000000000000000000000004";

test("K-T-12", () => {
  assert.equal(ANVIL_KEY, "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

  const walletOwned = planWatch({
    failedExecute: false,
    logs: [{ owner: wallet, spender, token }],
    allowlist: [],
    wallet,
    hot,
    allowances: { [`${token}:${spender}`]: 5n },
    childId: 2n,
  });
  assert.deepEqual(walletOwned.clears, [{ tokenId: 2n, token, spender }]);
  assert.equal(walletOwned.revoke, false);

  const hotOwned = planWatch({
    failedExecute: false,
    logs: [{ owner: hot, spender, token }],
    allowlist: [],
    wallet,
    hot,
    allowances: { [`${token}:${spender}`]: 5n },
    childId: 2n,
  });
  assert.deepEqual(hotOwned.clears, []);
  assert.deepEqual(hotOwned.notes, ["Needs the agent key"]);

  const failed = planWatch({
    failedExecute: true,
    logs: [],
    allowlist: [],
    wallet,
    hot,
    allowances: {},
    childId: 2n,
  });
  assert.equal(failed.revoke, true);
});
