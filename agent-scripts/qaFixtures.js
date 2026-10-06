// Screen fixtures for the QA cases that the live cold account does not have.
// They are answers the mock wallet returns. Nothing is sent to Sepolia.
//
//   npm run qa
//   open http://127.0.0.1:5173/?mock=1

import { ethers } from "ethers";

export const COLD = "0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836";
export const HOT = "0x67f49213ae30080250467bbc2fc9495f9C58dca8";
export const PERMISSION_TOKEN = "0xA09511600787d4BF40A49CE3501af2C23d737584";
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
export const ENS_REGISTRY = "0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4";
export const FROM_BLOCK = 11805675;

export const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
export const UNISWAP = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";
const UNI_NFT = "0x1238536071E1c677A632429e3655c799b22cDA52";
const SEAPORT = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC";
const METAMASK = "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B";
const ERC20_COLD = USDC;
const ERC20_AGENT = WETH;
const ERC20_SPENDER = UNISWAP;
const NFT_COLD = UNI_NFT;
const NFT_AGENT = UNI_NFT;
const NFT_OPERATOR = SEAPORT;
const PERMIT_TOKEN_COLD = USDC;
const PERMIT_TOKEN_AGENT = WETH;
const PERMIT_SPENDER = UNISWAP;
const DELEGATION = METAMASK;

const FROZEN_ID = 9001n;
export const ACTIVE_ID = 9002n;
const EXPIRY = 1893456000n;
const ROLE = 1n;
const ADMIN = ROLE << 128n;
const LOG_BLOCK = FROM_BLOCK + 20;

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
  "function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)",
]);

function same(left, right) {
  return left.toLowerCase() === right.toLowerCase();
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

function eventLog(iface, name, args) {
  return iface.encodeEventLog(name, args);
}

const sendAbi = new ethers.Interface([
  "function revoke(uint256 tokenId)",
  "function approve(address spender, uint256 amount)",
  "function setApprovalForAll(address operator, bool approved)",
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
  "function revokeRoles(uint256 resource, uint256 roleBitmap, address account)",
  "function revokeRootRoles(uint256 roleBitmap, address account)",
]);

const revokedIds = new Set();
const zeroAllowance = new Set();
const clearedOperator = new Set();
const zeroPermit = new Set();
const droppedRole = new Set();
const clearedDelegation = new Set();

function roleKey(resource, account) {
  return `${resource.toString()}:${ethers.getAddress(account)}`;
}

export function noteCaptured(tx) {
  const data = tx?.data ?? "0x";
  if ((data === "0x" || data === "0x0") && tx?.to) {
    clearedDelegation.add(ethers.getAddress(tx.to));
    return;
  }
  let parsed;
  try {
    parsed = sendAbi.parseTransaction({ data });
  } catch {
    return;
  }
  const to = tx?.to ? ethers.getAddress(tx.to) : COLD;
  const from = tx?.from ? ethers.getAddress(tx.from) : COLD;
  if (parsed.name === "revoke" && same(to, PERMISSION_TOKEN)) revokedIds.add(parsed.args[0].toString());
  if (parsed.name === "approve" && parsed.args.length === 2 && parsed.args[1] === 0n) {
    zeroAllowance.add(`${to}:${from}:${ethers.getAddress(parsed.args[0])}`);
  }
  if (parsed.name === "setApprovalForAll" && parsed.args[1] === false) {
    clearedOperator.add(`${to}:${from}:${ethers.getAddress(parsed.args[0])}`);
  }
  if (parsed.name === "approve" && parsed.args.length === 4 && parsed.args[2] === 0n) {
    zeroPermit.add(`${from}:${ethers.getAddress(parsed.args[0])}:${ethers.getAddress(parsed.args[1])}`);
  }
  if (parsed.name === "revokeRoles") droppedRole.add(roleKey(parsed.args[0], parsed.args[2]));
  if (parsed.name === "revokeRootRoles") droppedRole.add(roleKey(0n, parsed.args[1]));
}

export function overrideCall(tx) {
  if (!tx?.to || !tx.data) return null;
  const to = ethers.getAddress(tx.to);
  const data = tx.data;
  if (same(to, PERMISSION_TOKEN)) {
    const parsed = parse(permissionCall, data);
    if (parsed?.name === "ownerOf" && revokedIds.has(parsed.args[0].toString())) return "revert";
  }
  const allowance = parse(erc20Call, data);
  if (allowance && zeroAllowance.has(`${to}:${ethers.getAddress(allowance.args[0])}:${ethers.getAddress(allowance.args[1])}`)) {
    return erc20Call.encodeFunctionResult("allowance", [0n]);
  }
  const approved = parse(erc721Call, data);
  if (approved && clearedOperator.has(`${to}:${ethers.getAddress(approved.args[0])}:${ethers.getAddress(approved.args[1])}`)) {
    return erc721Call.encodeFunctionResult("isApprovedForAll", [false]);
  }
  const permit = parse(permitCall, data);
  if (permit && same(to, PERMIT2)) {
    const key = `${ethers.getAddress(permit.args[0])}:${ethers.getAddress(permit.args[1])}:${ethers.getAddress(permit.args[2])}`;
    if (zeroPermit.has(key)) return permitCall.encodeFunctionResult("allowance", [0n, 0n, 0n]);
  }
  return null;
}

export function clearedCode(account) {
  if (!account) return null;
  try {
    return clearedDelegation.has(ethers.getAddress(account)) ? "0x" : null;
  } catch {
    return null;
  }
}

const LOGS = [
  rawLog(PERMISSION_TOKEN, eventLog(minted, "PermissionMinted", [FROZEN_ID, HOT, 1n, 1000n, EXPIRY]), 9001),
  rawLog(PERMISSION_TOKEN, eventLog(minted, "PermissionMinted", [ACTIVE_ID, HOT, 1n, 1000n, EXPIRY]), 9002),
  rawLog(ERC20_COLD, eventLog(erc20Event, "Approval", [COLD, ERC20_SPENDER, 1000n]), 9101),
  rawLog(ERC20_AGENT, eventLog(erc20Event, "Approval", [HOT, ERC20_SPENDER, 50n]), 9102),
  rawLog(NFT_COLD, eventLog(erc721Event, "ApprovalForAll", [COLD, NFT_OPERATOR, true]), 9201),
  rawLog(NFT_AGENT, eventLog(erc721Event, "ApprovalForAll", [HOT, NFT_OPERATOR, true]), 9202),
  rawLog(PERMIT2, eventLog(permitEvent, "Approval", [COLD, PERMIT_TOKEN_COLD, PERMIT_SPENDER, 25n, EXPIRY]), 9301),
  rawLog(PERMIT2, eventLog(permitEvent, "Approval", [HOT, PERMIT_TOKEN_AGENT, PERMIT_SPENDER, 25n, EXPIRY]), 9302),
  rawLog(ENS_REGISTRY, eventLog(ensEvent, "EACRolesChanged", [11n, HOT, 0n, ROLE]), 9401),
  rawLog(ENS_REGISTRY, eventLog(ensEvent, "EACRolesChanged", [12n, HOT, 0n, ROLE]), 9402),
  rawLog(ENS_REGISTRY, eventLog(ensEvent, "EACRolesChanged", [0n, HOT, 0n, ROLE]), 9403),
];

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

export function qaLogs(filter = {}) {
  if (!inRange(filter)) return [];
  const topic0 = first(filter.topics?.[0]);
  const topic1 = first(filter.topics?.[1]);
  const address = first(filter.address);
  return LOGS.filter((item) => {
    if (topic0 && item.topics[0].toLowerCase() !== String(topic0).toLowerCase()) return false;
    if (topic1 && (item.topics[1] ?? "").toLowerCase() !== String(topic1).toLowerCase()) return false;
    if (address && !same(item.address, String(address))) return false;
    if (same(item.address, ENS_REGISTRY) && item.topics.length > 2) {
      const resource = BigInt(item.topics[1]);
      const account = ethers.getAddress(`0x${item.topics[2].slice(-40)}`);
      if (droppedRole.has(roleKey(resource, account))) return false;
    }
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

function isCold(account) {
  return same(account, COLD);
}

export function qaCall(tx) {
  if (!tx?.to || !tx.data) return null;
  const to = ethers.getAddress(tx.to);
  const data = tx.data;

  const allowance = parse(erc20Call, data);
  if (allowance && (same(to, ERC20_COLD) || same(to, ERC20_AGENT))) {
    const amount = same(allowance.args[0], COLD) ? 1000n : 50n;
    return erc20Call.encodeFunctionResult("allowance", [amount]);
  }

  const approved = parse(erc721Call, data);
  if (approved && (same(to, NFT_COLD) || same(to, NFT_AGENT))) {
    return erc721Call.encodeFunctionResult("isApprovedForAll", [true]);
  }

  const permit = parse(permitCall, data);
  if (permit && same(to, PERMIT2)) {
    const [owner, token] = permit.args;
    const known = (same(owner, COLD) && same(token, PERMIT_TOKEN_COLD))
      || (same(owner, HOT) && same(token, PERMIT_TOKEN_AGENT));
    if (!known) return null;
    return permitCall.encodeFunctionResult("allowance", [25n, EXPIRY, 0n]);
  }

  if (same(to, PERMISSION_TOKEN)) {
    const ownerOf = parse(permissionCall, data);
    if (!ownerOf) return null;
    if (ownerOf.name === "ownerOf" && (ownerOf.args[0] === FROZEN_ID || ownerOf.args[0] === ACTIVE_ID)) {
      return permissionCall.encodeFunctionResult("ownerOf", [HOT]);
    }
    if (ownerOf.name === "getPolicy" && (ownerOf.args[0] === FROZEN_ID || ownerOf.args[0] === ACTIVE_ID)) {
      return permissionCall.encodeFunctionResult("getPolicy", [[1000n, [UNISWAP], EXPIRY]]);
    }
    if (ownerOf.name === "isValid" && ownerOf.args[0] === FROZEN_ID) {
      return permissionCall.encodeFunctionResult("isValid", [false]);
    }
    if (ownerOf.name === "isValid" && ownerOf.args[0] === ACTIVE_ID) {
      return permissionCall.encodeFunctionResult("isValid", [true]);
    }
    return null;
  }

  if (same(to, ENS_REGISTRY)) {
    const roles = parse(ensCall, data);
    if (!roles || !isCold(roles.args[roles.args.length - 1])) return null;
    if (roles.name === "hasRoles" && roles.args[0] === 11n && roles.args[1] === ADMIN) {
      return ensCall.encodeFunctionResult("hasRoles", [true]);
    }
    if (roles.name === "hasRoles" && roles.args[0] === 12n && roles.args[1] === ADMIN) {
      return ensCall.encodeFunctionResult("hasRoles", [false]);
    }
    if (roles.name === "hasRootRoles" && roles.args[0] === ADMIN) {
      return ensCall.encodeFunctionResult("hasRootRoles", [true]);
    }
  }
  return null;
}

export function qaCode(account) {
  if (!account || !same(account, HOT)) return null;
  return `0xef0100${DELEGATION.slice(2).toLowerCase()}`;
}

export const checklist = [
  "K-T-5  Agent Allowances shows the agent token. The account's own allowances stay off this screen",
  "K-T-6  Agent Operators shows the agent NFT. The account's own operators stay off this screen",
  "K-T-7  Agent Permit2 shows the agent amount. The account's own Permit2 stays off this screen",
  "K-T-9  Agent shows the address, ACTIVE, and the agent spender",
  "K-T-10 Root Revoke. A child that can be revoked says Revoke agent",
  "K-T-11 Agent Allowances shows the two warnings and Revoke agent",
  "K-T-14 Agent Operators shows the two warnings and Revoke agent",
  "K-T-15 Agent Permit2 shows the two warnings and Revoke agent",
  "K-T-16 Agent Delegation shows the two warnings and Revoke agent",
  "K-T-17 Roles: resource 11 and 0 have Revoke agent. Resource 12 has no button",
  "FROZEN is token #9001 on the agent. A zero allowance is not listed",
];
