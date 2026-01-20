import type { EsiInventoryType } from './esi'

type EsiInventoryGroup = {
  group_id: number
  name: string
  types: number[]
}

type EsiNameEntry = {
  category: string
  id: number
  name: string
}

const ESI_BASE = 'https://esi.evetech.net/latest'
const CACHE_KEY = 'fc-tools.command-burst.ship-types.v2'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14

type GroupSpec = { id: number; name: string }

const COMMAND_BURST_GROUPS: GroupSpec[] = [
  { id: 1201, name: 'Attack Battlecruiser' },
  { id: 419, name: 'Combat Battlecruiser' },
  { id: 1534, name: 'Command Destroyer' },
  { id: 540, name: 'Command Ship' },
  { id: 4902, name: 'Expedition Command Ship' },
  { id: 941, name: 'Industrial Command Ship' },
  { id: 963, name: 'Strategic Cruiser' },
  { id: 30, name: 'Titan' },
  { id: 883, name: 'Capital Industrial Ship' },
]

const MINING_BURST_GROUP_IDS = new Set<number>([4902, 941, 883])

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timeout)
  }
}

function loadCachedTypes(): EsiInventoryType[] | null {
  const raw = window.localStorage.getItem(CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { savedAt: number; all: EsiInventoryType[]; mining: EsiInventoryType[] }
    if (!parsed?.savedAt || !Array.isArray(parsed.all) || !Array.isArray(parsed.mining)) return null
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null
    return parsed.all
  } catch {
    return null
  }
}

function loadCachedMiningTypes(): EsiInventoryType[] | null {
  const raw = window.localStorage.getItem(CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { savedAt: number; all: EsiInventoryType[]; mining: EsiInventoryType[] }
    if (!parsed?.savedAt || !Array.isArray(parsed.mining)) return null
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null
    return parsed.mining
  } catch {
    return null
  }
}

function saveCachedTypes(all: EsiInventoryType[], mining: EsiInventoryType[]) {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), all, mining }))
}

async function fetchGroup(groupId: number): Promise<EsiInventoryGroup> {
  return fetchJson<EsiInventoryGroup>(`${ESI_BASE}/universe/groups/${groupId}/?datasource=tranquility&language=en`)
}

async function postUniverseNames(ids: number[]): Promise<EsiNameEntry[]> {
  return fetchJson<EsiNameEntry[]>(
    `${ESI_BASE}/universe/names/?datasource=tranquility`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids),
    },
    15_000,
  )
}

export type CommandBurstShipTypes = {
  all: EsiInventoryType[]
  mining: EsiInventoryType[]
}

export async function fetchCommandBurstShipTypes(): Promise<CommandBurstShipTypes> {
  const cached = loadCachedTypes()
  const cachedMining = loadCachedMiningTypes()
  if (cached && cachedMining) return { all: cached, mining: cachedMining }

  const groups = await Promise.all(COMMAND_BURST_GROUPS.map((g) => fetchGroup(g.id)))
  const typeIdsAll = Array.from(new Set(groups.flatMap((g) => g.types)))
  const typeIdsMining = Array.from(new Set(groups.filter((g) => MINING_BURST_GROUP_IDS.has(g.group_id)).flatMap((g) => g.types)))

  const allNameEntries: EsiNameEntry[] = []
  for (const ids of chunk(typeIdsAll, 1000)) allNameEntries.push(...(await postUniverseNames(ids)))

  const miningNameEntries: EsiNameEntry[] = []
  for (const ids of chunk(typeIdsMining, 1000)) miningNameEntries.push(...(await postUniverseNames(ids)))

  const all = allNameEntries
    .filter((e) => e.category === 'inventory_type')
    .map((e) => ({ id: e.id, name: e.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const mining = miningNameEntries
    .filter((e) => e.category === 'inventory_type')
    .map((e) => ({ id: e.id, name: e.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  saveCachedTypes(all, mining)
  return { all, mining }
}
