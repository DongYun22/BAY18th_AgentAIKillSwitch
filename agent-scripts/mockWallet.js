// Mock wallet for local testing. It signs in as the cold account already on Sepolia.
// Reads go to the public Sepolia RPC. Revoke clicks are captured and are not broadcast.
//
//   npm run mock
//   open http://127.0.0.1:5173/?mock=1
//
//   npm run mock -- --once
// prints the tree and exits.

import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { ethers } from "ethers";
import { PERMISSION_TOKEN_ABI } from "./abis.js";

export const COLD = "0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836";
export const PERMISSION_TOKEN = "0xA09511600787d4BF40A49CE3501af2C23d737584";
export const FROM_BLOCK = 11805675;
export const PORT = 8787;

const RPC_URL = process.env.RPC_URL || "https://sepolia.gateway.tenderly.co";
const REVOKE = new ethers.Interface(["function revoke(uint256 tokenId)"]);
const captured = [];
const readCache = new Map();
const readSlots = [];
let readsActive = 0;
let captureCount = 0;
let announcedRead = false;

export function describeSend(tx) {
  const data = tx?.data ?? "0x";
  try {
    const parsed = REVOKE.parseTransaction({ data });
    return `PermissionToken.revoke(${parsed.args[0].toString()})`;
  } catch {
    const to = tx?.to ?? "unknown";
    return `call ${to} ${data.slice(0, 10)}`;
  }
}

function fakeHash() {
  captureCount += 1;
  return ethers.zeroPadValue(ethers.toBeHex(captureCount), 32);
}

function receipt(hash) {
  const found = captured.find((item) => item.hash === hash);
  if (!found) return null;
  return {
    transactionHash: hash,
    transactionIndex: "0x0",
    blockHash: ethers.ZeroHash,
    blockNumber: "0x1",
    from: COLD,
    to: found.tx.to ?? null,
    cumulativeGasUsed: "0x0",
    gasUsed: "0x0",
    contractAddress: null,
    logs: [],
    logsBloom: `0x${"0".repeat(512)}`,
    status: "0x1",
    type: "0x2",
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleRead(job) {
  return new Promise((resolve, reject) => {
    readSlots.push({ job, resolve, reject });
    pumpReads();
  });
}

function pumpReads() {
  while (readsActive < 3 && readSlots.length > 0) {
    const item = readSlots.shift();
    readsActive += 1;
    item.job()
      .then(item.resolve, item.reject)
      .finally(() => {
        readsActive -= 1;
        pumpReads();
      });
  }
}

function cacheable(method) {
  return method === "eth_call"
    || method === "eth_getLogs"
    || method === "eth_getCode"
    || method === "eth_getBlockByNumber"
    || method === "eth_blockNumber";
}

async function forward(body) {
  const key = JSON.stringify({ method: body.method, params: body.params });
  const hit = readCache.get(key);
  if (hit) return hit;
  return scheduleRead(() => fetchUpstream(body, key));
}

async function fetchUpstream(body, key) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await delay(50);
      const response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12000),
      });
      const json = await response.json();
      const message = json.error?.message ?? "";
      if (/rate limit/i.test(message) && attempt < 3) {
        await delay(1000 * (attempt + 1));
        continue;
      }
      if (!json.error && cacheable(body.method)) readCache.set(key, json);
      return json;
    } catch (error) {
      if (body.method === "eth_getLogs") {
        console.log("[mock wallet] log scan skipped");
        return { jsonrpc: "2.0", id: body.id, result: [] };
      }
      if (attempt < 3) {
        await delay(400);
        continue;
      }
      throw error;
    }
  }
  return { jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "rate limit exceeded" } };
}

async function rpc(body) {
  const method = body.method;
  if (method === "eth_sendTransaction" || method === "eth_sendRawTransaction") {
    const tx = body.params?.[0] ?? {};
    const hash = fakeHash();
    const line = describeSend(tx);
    captured.push({ hash, tx, line });
    console.log(`[mock wallet] captured ${line}`);
    console.log("[mock wallet] not broadcast");
    return { jsonrpc: "2.0", id: body.id, result: hash };
  }
  if (method === "eth_getTransactionReceipt") {
    const found = receipt(body.params?.[0]);
    if (found) return { jsonrpc: "2.0", id: body.id, result: found };
  }
  if (method === "eth_getTransactionByHash") {
    const hash = body.params?.[0];
    const found = captured.find((item) => item.hash === hash);
    if (found) {
      return {
        jsonrpc: "2.0",
        id: body.id,
        result: {
          hash,
          from: COLD,
          to: found.tx.to ?? null,
          input: found.tx.data ?? "0x",
          nonce: "0x0",
          value: "0x0",
          gas: "0x186A0",
          blockNumber: "0x1",
          blockHash: ethers.ZeroHash,
          transactionIndex: "0x0",
        },
      };
    }
  }
  if (method === "eth_estimateGas") {
    return { jsonrpc: "2.0", id: body.id, result: "0x186A0" };
  }
  if (method === "eth_getTransactionCount") {
    return { jsonrpc: "2.0", id: body.id, result: "0x0" };
  }
  if (method === "eth_gasPrice" || method === "eth_maxFeePerGas" || method === "eth_maxPriorityFeePerGas") {
    return { jsonrpc: "2.0", id: body.id, result: "0x3B9ACA00" };
  }
  if (!announcedRead && (method === "eth_getLogs" || method === "eth_call" || method === "eth_blockNumber")) {
    announcedRead = true;
    console.log("[mock wallet] page is reading Sepolia");
  }
  const result = await forward(body);
  if (result.error && result.error.message !== "execution reverted") {
    console.error(`[mock wallet] ${method} ${result.error.message}`);
  }
  return result;
}

const providerSource = `window.ethereum = {
  async request(args) {
    const method = args.method
    const params = args.params || []
    if (method === "eth_requestAccounts" || method === "eth_accounts") {
      return ["${COLD}"]
    }
    if (method === "eth_chainId") return "0xaa36a7"
    if (method === "wallet_switchEthereumChain") return null
    const response = await fetch("http://127.0.0.1:${PORT}/rpc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    })
    const body = await response.json()
    if (body.error) {
      const error = new Error(body.error.message || "Mock wallet rejected the call")
      error.code = body.error.code
      error.data = body.error.data
      throw error
    }
    return body.result
  },
  on() {},
  removeListener() {},
};
`;

function startBridge() {
  const server = createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.url === "/provider.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(providerSource);
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    try {
      const result = await rpc(body);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32000, message: error.message } }));
    }
  });
  return new Promise((resolve) => {
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function logsInChunks(provider, filter) {
  const latest = await provider.getBlockNumber();
  const logs = [];
  for (let from = FROM_BLOCK; from <= latest; from += 50_000) {
    const to = Math.min(from + 49_999, latest);
    const found = await provider.getLogs({ ...filter, fromBlock: from, toBlock: to });
    logs.push(...found);
  }
  return logs;
}

export async function loadTree(provider) {
  const token = new ethers.Contract(PERMISSION_TOKEN, PERMISSION_TOKEN_ABI, provider);
  const iface = new ethers.Interface(PERMISSION_TOKEN_ABI);
  const raw = await logsInChunks(provider, { address: PERMISSION_TOKEN, topics: [iface.getEvent("PermissionMinted").topicHash] });
  const block = await provider.getBlock("latest");
  const rows = [];
  for (const item of raw) {
    const decoded = iface.parseLog(item);
    const tokenId = decoded.args.tokenId;
    const holder = ethers.getAddress(decoded.args.to);
    const parentId = decoded.args.parentId;
    let keep = false;
    if (parentId === 0n) keep = holder.toLowerCase() === COLD.toLowerCase();
    else {
      try {
        const owner = await token.ownerOf(parentId);
        keep = owner.toLowerCase() === COLD.toLowerCase();
      } catch {
        keep = false;
      }
    }
    if (!keep) continue;
    const rawPolicy = await token.getPolicy(tokenId);
    const policy = rawPolicy.allowlist ? rawPolicy : rawPolicy[0];
    let status = "ACTIVE";
    try {
      await token.ownerOf(tokenId);
      if (policy.expiry <= BigInt(block.timestamp)) status = "EXPIRED";
      else if (!(await token.isValid(tokenId))) status = "FROZEN";
    } catch {
      status = "REVOKED";
    }
    rows.push({
      tokenId,
      holder,
      parentId,
      status,
      spendingLimit: policy.spendingLimit,
      expiry: policy.expiry,
      allowlist: policy.allowlist,
    });
  }
  rows.sort((left, right) => (left.tokenId < right.tokenId ? -1 : left.tokenId > right.tokenId ? 1 : 0));
  return rows;
}

function lineFor(row) {
  const list = row.allowlist.length === 0 ? "none" : row.allowlist.join(",");
  return `#${row.tokenId} ${row.status} ${row.spendingLimit} wei exp ${row.expiry} allow ${list}`;
}

export function renderTree(rows) {
  const lines = ["Kill-switch", `Account ${COLD}`];
  const roots = rows.filter((row) => row.parentId === 0n && row.holder.toLowerCase() === COLD.toLowerCase());
  const agents = new Map();
  for (const row of rows) {
    if (row.parentId === 0n && row.holder.toLowerCase() === COLD.toLowerCase()) continue;
    const list = agents.get(row.holder) ?? [];
    list.push(row);
    agents.set(row.holder, list);
  }
  for (const row of roots) {
    lines.push(lineFor(row));
    if (row.status !== "REVOKED") lines.push(`Revoke would send PermissionToken.revoke(${row.tokenId}) — not broadcast`);
  }
  if (agents.size === 0) lines.push("No agents for this account");
  for (const [agent, permissions] of agents) {
    lines.push(`Agent ${agent}`);
    for (const row of permissions) {
      lines.push(lineFor(row));
      if (row.status !== "REVOKED") lines.push(`Revoke agent would send PermissionToken.revoke(${row.tokenId}) — not broadcast`);
    }
  }
  return lines;
}

async function printTree() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const rows = await loadTree(provider);
  for (const line of renderTree(rows)) console.log(line);
}

async function main() {
  const once = process.argv.includes("--once");
  await startBridge();
  console.log("Mock wallet is the cold account. No private key is loaded.");
  console.log("Open http://127.0.0.1:5173/?mock=1 and click Connect.");
  console.log("A Revoke click is printed here and is not sent to Sepolia.");
  if (once) {
    await printTree();
    process.exit(0);
  }
  printTree().catch((error) => {
    console.error("[mock wallet] tree read failed:", error.shortMessage || error.message);
  });
}

function isMain() {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (isMain()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
