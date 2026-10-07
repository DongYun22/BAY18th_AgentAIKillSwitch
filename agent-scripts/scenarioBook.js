// A fresh account and one agent. Nothing here is the old Sepolia cold wallet,
// and nothing is broadcast. The scene server returns only these logs.

import { ethers } from "ethers";
import { planWatch } from "./watcher.js";
import { ENS_REGISTRY, FROM_BLOCK, PERMISSION_TOKEN, PERMIT2, UNISWAP } from "./qaFixtures.js";

const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
const UNI_NFT = "0x1238536071E1c677A632429e3655c799b22cDA52";
const SEAPORT = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC";
const METAMASK = "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B";
const AGENT_WALLET = "0x0B26b3d6500E8Cf03189042b3341d5be7774d29F";
const OUTSIDE = "0x00000000000000000000000000000000000000b1";
const LOG_BLOCK = FROM_BLOCK + 20;
const EXPIRY = 1893456000n;
const ROOT_LIMIT = 3000000000000000n;
const CHILD_LIMIT = 1000000000000000n;
const WETH_AMOUNT = 1000000000000000000n;
const PERMIT_AMOUNT = 250000000000000000n;
const ROLE = 1n;
const ADMIN = ROLE << 128n;
const ROOT_ID = 4n;
const MANUAL_ID = 1n;
const AUTO_ID = 2n;
const LIVE_ID = 3n;

function sceneAddress(label) {
  return ethers.getAddress(`0x${ethers.id(label).slice(-40)}`);
}

export const SCENE_OWNER = sceneAddress("bay-killswitch-scenario-owner");
export const SCENE_AGENT = sceneAddress("bay-killswitch-scenario-agent");

const minted = new ethers.Interface([
  "event PermissionMinted(uint256 indexed tokenId, address indexed to, uint256 indexed parentId, uint256 spendingLimit, uint64 expiry)",
]);
const erc20Event = new ethers.Interface([
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);
const erc721Event = new ethers.Interface([
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
]);
const permitEvent = new ethers.Interface([
  "event Approval(address indexed owner, address indexed token, address indexed spender, uint160 amount, uint48 expiration)",
]);
const ensEvent = new ethers.Interface([
  "event EACRolesChanged(uint256 indexed resource, address indexed account, uint256 oldRoleBitmap, uint256 newRoleBitmap)",
]);
const erc20Call = new ethers.Interface([
  "function allowance(address owner, address spender) view returns (uint256)",
]);
const erc721Call = new ethers.Interface([
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
]);
const permitCall = new ethers.Interface([
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
]);
const permissionCall = new ethers.Interface([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getPolicy(uint256 tokenId) view returns ((uint256 spendingLimit, address[] allowlist, uint64 expiry))",
  "function isValid(uint256 tokenId) view returns (bool)",
]);
const ensCall = new ethers.Interface([
  "function hasRoles(uint256 resource, uint256 roleBitmap, address account) view returns (bool)",
]);

let logs = [];
let revoked = new Set();
let frozen = new Set();
let watch = [];
let revision = 0;
let playing = false;

const HEAD = FROM_BLOCK + 30;

function bump() {
  revision += 1;
}

export function sceneRevision() {
  return revision;
}

export function sceneHead() {
  return HEAD;
}

export function sceneBlock() {
  return {
    number: ethers.toQuantity(HEAD),
    hash: ethers.ZeroHash,
    parentHash: ethers.ZeroHash,
    timestamp: ethers.toQuantity(Math.floor(Date.now() / 1000)),
    gasLimit: "0x1c9c380",
    gasUsed: "0x0",
    miner: ethers.ZeroAddress,
    difficulty: "0x0",
    totalDifficulty: "0x0",
    extraData: "0x",
    size: "0x0",
    logsBloom: `0x${"0".repeat(512)}`,
    transactionsRoot: ethers.ZeroHash,
    stateRoot: ethers.ZeroHash,
    receiptsRoot: ethers.ZeroHash,
    sha3Uncles: ethers.ZeroHash,
    nonce: "0x0000000000000000",
    baseFeePerGas: "0x1",
    transactions: [],
    uncles: [],
  };
}

function same(left, right) {
  return String(left).toLowerCase() === String(right).toLowerCase();
}

function rawLog(address, encoded, index) {
  return {
    address,
    topics: encoded.topics,
    data: encoded.data,
    blockNumber: ethers.toQuantity(LOG_BLOCK),
    blockHash: ethers.ZeroHash,
    transactionHash: ethers.zeroPadValue(ethers.toBeHex(index), 32),
    transactionIndex: "0x0",
    logIndex: ethers.toQuantity(index),
    removed: false,
  };
}

function mint(tokenId, to, parentId, limit, index) {
  return rawLog(PERMISSION_TOKEN, minted.encodeEventLog("PermissionMinted", [tokenId, to, parentId, limit, EXPIRY]), index);
}

export function sceneEvents() {
  return watch;
}

function grants() {
  return [
    mint(ROOT_ID, SCENE_OWNER, 0n, ROOT_LIMIT, 1),
    mint(MANUAL_ID, SCENE_AGENT, ROOT_ID, CHILD_LIMIT, 2),
    mint(AUTO_ID, SCENE_AGENT, ROOT_ID, CHILD_LIMIT, 3),
    mint(LIVE_ID, SCENE_AGENT, ROOT_ID, CHILD_LIMIT, 4),
    rawLog(WETH, erc20Event.encodeEventLog("Approval", [SCENE_AGENT, UNISWAP, WETH_AMOUNT]), 5),
    rawLog(UNI_NFT, erc721Event.encodeEventLog("ApprovalForAll", [SCENE_AGENT, SEAPORT, true]), 6),
    rawLog(PERMIT2, permitEvent.encodeEventLog("Approval", [SCENE_AGENT, WETH, UNISWAP, PERMIT_AMOUNT, EXPIRY]), 7),
    rawLog(ENS_REGISTRY, ensEvent.encodeEventLog("EACRolesChanged", [11n, SCENE_AGENT, 0n, ROLE]), 8),
  ];
}

function blockedEvent() {
  return {
    level: "EXEC",
    actor: "Hot Agent",
    detail: `P#${AUTO_ID} → ${OUTSIDE} · 0.0001 ETH`,
    note: "target not in allowlist",
    result: "BLOCKED",
    seconds: null,
  };
}

// V2: the wallet blocks the call and freezes the permission in that same transaction.
function frozenEvent() {
  return { ...blockedEvent(), result: "FROZEN" };
}

function autoEvent() {
  return {
    level: "KILL",
    actor: "Owner",
    detail: `Permission #${AUTO_ID} revoke`,
    note: "",
    result: "REVOKED",
    seconds: 2,
  };
}

export function stageOpen() {
  logs = grants();
  revoked = new Set();
  frozen = new Set();
  watch = [];
  bump();
}

export function stageFrozen() {
  frozen.add(AUTO_ID.toString());
  watch = [frozenEvent()];
  bump();
}

export function stageEscalated() {
  revoked.add(AUTO_ID.toString());
  watch = [frozenEvent(), autoEvent()];
  bump();
}

export function stageBlocked() {
  const plan = planWatch({
    failedExecute: true,
    logs: [],
    allowlist: [UNISWAP],
    wallet: AGENT_WALLET,
    hot: SCENE_AGENT,
    allowances: {},
    childId: AUTO_ID,
  });
  if (!plan.revoke) throw new Error("auto revoke did not plan a revoke");
  watch = [blockedEvent()];
  bump();
}

export function stageAuto() {
  revoked.add(AUTO_ID.toString());
  watch = [blockedEvent(), autoEvent()];
  bump();
}

export function stageManual() {
  revoked.add(MANUAL_ID.toString());
  bump();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function playScenario(write) {
  if (playing) {
    write("already playing\n");
    return;
  }
  playing = true;
  try {
    stageOpen();
    write("beat 0 — #1 #2 #3 ACTIVE. Watch the page.\n");
    await delay(1600);
    stageBlocked();
    write(`beat 1 — #2 blocked · target not in allowlist · ${OUTSIDE}\n`);
    await delay(2000);
    stageAuto();
    write("beat 2 — auto response 2s · #2 REVOKED\n");
    await delay(1600);
    stageManual();
    write("beat 3 — owner revoke #1 · no auto response\n");
    write("#3 stays ACTIVE. Revoke agent is still on the agent rows.\n");
  } finally {
    playing = false;
  }
}

// V2: no gap between the blocked call and the stop. The watcher only escalates afterwards.
export async function playScenarioV2(write) {
  if (playing) {
    write("already playing\n");
    return;
  }
  playing = true;
  try {
    stageOpen();
    write("beat 0 — #1 #2 #3 ACTIVE. Watch the page.\n");
    await delay(1600);
    stageFrozen();
    write(`beat 1 — #2 blocked · target not in allowlist · ${OUTSIDE} · FROZEN in the same tx\n`);
    await delay(2000);
    stageEscalated();
    write("beat 2 — watcher escalates the freeze 2s later · #2 REVOKED\n");
    write("#1 and #3 stay ACTIVE.\n");
  } finally {
    playing = false;
  }
}

function first(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function inRange(filter) {
  const from = filter.fromBlock === undefined ? null : Number(filter.fromBlock);
  const to = filter.toBlock === undefined ? null : Number(filter.toBlock);
  if (from !== null && Number.isFinite(from) && LOG_BLOCK < from) return false;
  if (to !== null && Number.isFinite(to) && LOG_BLOCK > to) return false;
  return true;
}

export function sceneLogs(filter = {}) {
  if (!inRange(filter)) return [];
  const topic0 = first(filter.topics?.[0]);
  const topic1 = first(filter.topics?.[1]);
  const address = first(filter.address);
  return logs.filter((item) => {
    if (topic0 && item.topics[0].toLowerCase() !== String(topic0).toLowerCase()) return false;
    if (topic1 && (item.topics[1] ?? "").toLowerCase() !== String(topic1).toLowerCase()) return false;
    if (address && !same(item.address, String(address))) return false;
    return true;
  });
}

function parse(iface, data) {
  try {
    return iface.parseTransaction({ data });
  } catch {
    return null;
  }
}

function policyFor(tokenId) {
  const limit = tokenId === ROOT_ID ? ROOT_LIMIT : CHILD_LIMIT;
  return permissionCall.encodeFunctionResult("getPolicy", [[limit, [UNISWAP], EXPIRY]]);
}

export function sceneCall(tx) {
  if (logs.length === 0 || !tx?.to || !tx.data) return null;
  const to = ethers.getAddress(tx.to);
  const data = tx.data;

  if (same(to, PERMISSION_TOKEN)) {
    const parsed = parse(permissionCall, data);
    if (!parsed) return null;
    const id = parsed.args[0];
    const known = id === ROOT_ID || id === MANUAL_ID || id === AUTO_ID || id === LIVE_ID;
    if (!known) return null;
    if (parsed.name === "ownerOf") {
      if (revoked.has(id.toString())) return "revert";
      const holder = id === ROOT_ID ? SCENE_OWNER : SCENE_AGENT;
      return permissionCall.encodeFunctionResult("ownerOf", [holder]);
    }
    if (parsed.name === "getPolicy") return policyFor(id);
    if (parsed.name === "isValid") return permissionCall.encodeFunctionResult("isValid", [!revoked.has(id.toString()) && !frozen.has(id.toString())]);
    return null;
  }

  const allowance = parse(erc20Call, data);
  if (allowance && same(to, WETH) && same(allowance.args[0], SCENE_AGENT)) {
    return erc20Call.encodeFunctionResult("allowance", [WETH_AMOUNT]);
  }

  const approved = parse(erc721Call, data);
  if (approved && same(to, UNI_NFT) && same(approved.args[0], SCENE_AGENT)) {
    return erc721Call.encodeFunctionResult("isApprovedForAll", [true]);
  }

  const permit = parse(permitCall, data);
  if (permit && same(to, PERMIT2) && same(permit.args[0], SCENE_AGENT) && same(permit.args[1], WETH)) {
    return permitCall.encodeFunctionResult("allowance", [PERMIT_AMOUNT, EXPIRY, 0n]);
  }

  if (same(to, ENS_REGISTRY)) {
    const roles = parse(ensCall, data);
    if (!roles || roles.name !== "hasRoles") return null;
    if (roles.args[0] === 11n && roles.args[1] === ADMIN && same(roles.args[2], SCENE_OWNER)) {
      return ensCall.encodeFunctionResult("hasRoles", [true]);
    }
  }
  return null;
}

export function sceneCode(account) {
  if (!account) return null;
  try {
    const key = ethers.getAddress(account);
    if (same(key, SCENE_OWNER)) return "0x";
    if (same(key, SCENE_AGENT)) return `0xef0100${METAMASK.slice(2).toLowerCase()}`;
    return null;
  } catch {
    return null;
  }
}
