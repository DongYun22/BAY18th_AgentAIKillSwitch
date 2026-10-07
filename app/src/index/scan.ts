import { config } from '../config'
import type { Address, ChainLog, ReadClient } from '../types'

export async function scanLogs(
  client: ReadClient,
  event: unknown,
  args: Record<string, unknown> | undefined,
  address?: Address,
): Promise<ChainLog[]> {
  const latest = await client.getBlockNumber()
  const logs: ChainLog[] = []
  let cursor = BigInt(config.fromBlock)
  while (cursor <= latest) {
    const chunkEnd = cursor + BigInt(config.logChunk) - 1n
    const end = chunkEnd < latest ? chunkEnd : latest
    try {
      const found = await client.getLogs({
        address,
        fromBlock: cursor,
        toBlock: end,
        event,
        args,
      })
      logs.push(...found)
    } catch {
      throw new Error('Log scan failed')
    }
    cursor = end + 1n
  }
  return logs
}

export function laterLog(left: ChainLog, right: ChainLog): ChainLog {
  if (left.blockNumber !== right.blockNumber) {
    return left.blockNumber > right.blockNumber ? left : right
  }
  return left.logIndex > right.logIndex ? left : right
}
