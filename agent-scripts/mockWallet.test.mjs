import assert from "node:assert/strict";
import { test } from "node:test";
import { ethers } from "ethers";
import { COLD, describeSend, renderTree } from "./mockWallet.js";

test("mock wallet names the cold account and does not broadcast a revoke", () => {
  assert.equal(COLD, "0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836");
  const data = new ethers.Interface(["function revoke(uint256 tokenId)"]).encodeFunctionData("revoke", [2]);
  assert.equal(describeSend({ to: "0xA09511600787d4BF40A49CE3501af2C23d737584", data }), "PermissionToken.revoke(2)");
  const lines = renderTree([
    {
      tokenId: 2n,
      holder: "0x67f49213ae30080250467bbc2fc9495f9c58dca8",
      parentId: 1n,
      status: "ACTIVE",
      spendingLimit: 8n,
      expiry: 10n,
      allowlist: [],
    },
  ]);
  assert.equal(lines.includes("Revoke agent would send PermissionToken.revoke(2) — not broadcast"), true);
  assert.equal(lines.some((line) => line.includes("broadcast to sepolia")), false);
});
