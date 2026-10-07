import assert from "node:assert/strict";
import test from "node:test";
import { ethers } from "ethers";
import { COLD, checklist, noteCaptured, overrideCall, qaCall, qaCode, qaLogs } from "./qaFixtures.js";

const erc20 = new ethers.Interface([
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
const permission = new ethers.Interface([
  "function isValid(uint256 tokenId) view returns (bool)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

test("qa fixtures cover one screen row for each approval check", () => {
  const text = checklist.join("\n");
  for (const id of ["K-T-5", "K-T-6", "K-T-7", "K-T-9", "K-T-10", "K-T-11", "K-T-14", "K-T-15", "K-T-16", "K-T-17"]) {
    assert.match(text, new RegExp(id));
  }

  const topic = erc20.getEvent("Approval").topicHash;
  const owner = ethers.zeroPadValue(COLD, 32);
  const logs = qaLogs({ topics: [topic, owner], fromBlock: "0xb423eb", toBlock: "0xb4e6fb" });
  assert.equal(logs.length, 1);
  const amount = qaCall({
    to: logs[0].address,
    data: erc20.encodeFunctionData("allowance", [COLD, "0x000000000000000000000000000000000000E203"]),
  });
  assert.equal(BigInt(amount), 1000n);

  const frozen = qaCall({
    to: "0xA09511600787d4BF40A49CE3501af2C23d737584",
    data: permission.encodeFunctionData("isValid", [9001n]),
  });
  assert.equal(BigInt(frozen), 0n);
  assert.equal(qaCall({
    to: "0xA09511600787d4BF40A49CE3501af2C23d737584",
    data: permission.encodeFunctionData("ownerOf", [1n]),
  }), null);

  const code = qaCode("0x67f49213ae30080250467bbc2fc9495f9C58dca8");
  assert.equal(code.startsWith("0xef0100"), true);
  assert.equal(code.slice(8).length, 40);
  assert.equal(qaCode(COLD), null);
  assert.equal(qaLogs({ fromBlock: "0x1", toBlock: "0x2" }).length, 0);

  const revoke = new ethers.Interface(["function revoke(uint256 tokenId)"]);
  noteCaptured({
    from: COLD,
    to: "0xA09511600787d4BF40A49CE3501af2C23d737584",
    data: revoke.encodeFunctionData("revoke", [1n]),
  });
  assert.equal(overrideCall({
    to: "0xA09511600787d4BF40A49CE3501af2C23d737584",
    data: permission.encodeFunctionData("ownerOf", [1n]),
  }), "revert");
});
