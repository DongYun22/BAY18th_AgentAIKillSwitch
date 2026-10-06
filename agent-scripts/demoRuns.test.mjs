import assert from "node:assert/strict";
import test from "node:test";
import { ethers } from "ethers";
import { runAuto, runExisting, watchEvents } from "./demoRuns.js";
import { ACTIVE_ID, HOT, PERMISSION_TOKEN, overrideCall, qaCall } from "./qaFixtures.js";

const permission = new ethers.Interface([
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

function ownerOf(tokenId) {
  return {
    to: PERMISSION_TOKEN,
    data: permission.encodeFunctionData("ownerOf", [tokenId]),
  };
}

test("demo runs revoke an existing child, then pair a blocked execute with auto revoke", () => {
  const first = runExisting();
  assert.match(first, /New run 1/);
  assert.match(first, /#9002 stays ACTIVE/);
  assert.equal(overrideCall(ownerOf(9001n)), "revert");

  const stillActive = qaCall(ownerOf(ACTIVE_ID));
  assert.equal(ethers.getAddress(ethers.AbiCoder.defaultAbiCoder().decode(["address"], stillActive)[0]), ethers.getAddress(HOT));
  assert.equal(watchEvents().length, 0);

  const second = runAuto();
  assert.match(second, /revoke tx: PermissionToken\.revoke\(9002\)/);
  assert.equal(overrideCall(ownerOf(ACTIVE_ID)), "revert");
  assert.deepEqual(watchEvents().map((event) => event.level), ["EXEC", "KILL"]);
  assert.equal(watchEvents()[0].result, "BLOCKED");
  assert.equal(watchEvents()[1].seconds, 2);
});
