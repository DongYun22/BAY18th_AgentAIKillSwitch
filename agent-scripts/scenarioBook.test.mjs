import assert from "node:assert/strict";
import test from "node:test";
import { ethers } from "ethers";
import { COLD, HOT, PERMISSION_TOKEN } from "./qaFixtures.js";
import {
  SCENE_AGENT,
  SCENE_OWNER,
  sceneCall,
  sceneEvents,
  sceneLogs,
  sceneRevision,
  stageAuto,
  stageBlocked,
  stageEscalated,
  stageFrozen,
  stageManual,
  stageOpen,
} from "./scenarioBook.js";

const permission = new ethers.Interface([
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

function ownerOf(id) {
  return sceneCall({
    to: PERMISSION_TOKEN,
    data: permission.encodeFunctionData("ownerOf", [id]),
  });
}

test("the scenario plays a blocked execute, then an auto revoke, on a new account", () => {
  assert.notEqual(SCENE_OWNER.toLowerCase(), COLD.toLowerCase());
  assert.notEqual(SCENE_AGENT.toLowerCase(), HOT.toLowerCase());
  const before = sceneRevision();
  stageOpen();
  assert.equal(sceneRevision(), before + 1);
  assert.equal(ethers.getAddress(ethers.AbiCoder.defaultAbiCoder().decode(["address"], ownerOf(2n))[0]), SCENE_AGENT);
  assert.equal(sceneEvents().length, 0);
  assert.equal(sceneLogs().length > 0, true);

  stageBlocked();
  assert.equal(ownerOf(2n) === "revert", false);
  assert.equal(sceneEvents()[0].result, "BLOCKED");
  assert.equal(sceneEvents()[0].note, "target not in allowlist");

  stageAuto();
  assert.equal(ownerOf(2n), "revert");
  assert.equal(sceneEvents()[1].seconds, 2);
  assert.equal(ownerOf(1n) === "revert", false);

  stageManual();
  assert.equal(ownerOf(1n), "revert");
  assert.equal(ownerOf(3n) === "revert", false);
  assert.equal(sceneEvents().filter((event) => event.seconds !== null).length, 1);
});

const validity = new ethers.Interface(["function isValid(uint256 tokenId) view returns (bool)"]);

function isValid(id) {
  const result = sceneCall({ to: PERMISSION_TOKEN, data: validity.encodeFunctionData("isValid", [id]) });
  return validity.decodeFunctionResult("isValid", result)[0];
}

test("the v2 scenario freezes in the blocked call, then the watcher escalates", () => {
  stageOpen();
  assert.equal(isValid(2n), true);

  stageFrozen();
  assert.equal(sceneEvents()[0].result, "FROZEN");
  assert.equal(isValid(2n), false);
  assert.equal(ownerOf(2n) === "revert", false);
  assert.equal(isValid(3n), true);

  stageEscalated();
  assert.equal(ownerOf(2n), "revert");
  assert.equal(sceneEvents()[1].seconds, 2);

  stageOpen();
  assert.equal(isValid(2n), true);
});
