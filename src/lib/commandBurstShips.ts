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
const CACHE_KEY = 'fc-tools.command-burst.ship-types.v3'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14

const COMBAT_BURST_GROUP_IDS = new Set<number>([1201, 419, 1534, 540, 963, 30])
const MINING_BURST_GROUP_IDS = new Set<number>([941, 883])
const EXPEDITION_BURST_GROUP_IDS = new Set<number>([4902])

const COMMAND_BURST_GROUP_IDS = Array.from(
  new Set<number>([...COMBAT_BURST_GROUP_IDS, ...MINING_BURST_GROUP_IDS, ...EXPEDITION_BURST_GROUP_IDS]),
)

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
    const parsed = JSON.parse(raw) as {
      savedAt: number
      combat: EsiInventoryType[]
      mining: EsiInventoryType[]
      expedition: EsiInventoryType[]
    }
    if (!parsed?.savedAt || !Array.isArray(parsed.combat) || !Array.isArray(parsed.mining) || !Array.isArray(parsed.expedition))
      return null
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null
    return parsed.combat
  } catch {
    return null
  }
}

function loadCachedMiningTypes(): EsiInventoryType[] | null {
  const raw = window.localStorage.getItem(CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as {
      savedAt: number
      combat: EsiInventoryType[]
      mining: EsiInventoryType[]
      expedition: EsiInventoryType[]
    }
    if (!parsed?.savedAt || !Array.isArray(parsed.mining)) return null
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null
    return parsed.mining
  } catch {
    return null
  }
}

function loadCachedExpeditionTypes(): EsiInventoryType[] | null {
  const raw = window.localStorage.getItem(CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as {
      savedAt: number
      combat: EsiInventoryType[]
      mining: EsiInventoryType[]
      expedition: EsiInventoryType[]
    }
    if (!parsed?.savedAt || !Array.isArray(parsed.expedition)) return null
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null
    return parsed.expedition
  } catch {
    return null
  }
}

function saveCachedTypes(combat: EsiInventoryType[], mining: EsiInventoryType[], expedition: EsiInventoryType[]) {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), combat, mining, expedition }))
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
  combat: EsiInventoryType[]
  mining: EsiInventoryType[]
  expedition: EsiInventoryType[]
}

export async function fetchCommandBurstShipTypes(): Promise<CommandBurstShipTypes> {
  const cached = loadCachedTypes()
  const cachedMining = loadCachedMiningTypes()
  const cachedExpedition = loadCachedExpeditionTypes()
  if (cached && cachedMining && cachedExpedition) return { combat: cached, mining: cachedMining, expedition: cachedExpedition }

  const groups = await Promise.all(COMMAND_BURST_GROUP_IDS.map((id) => fetchGroup(id)))
  const typeIdsCombat = Array.from(new Set(groups.filter((g) => COMBAT_BURST_GROUP_IDS.has(g.group_id)).flatMap((g) => g.types)))
  const typeIdsMining = Array.from(new Set(groups.filter((g) => MINING_BURST_GROUP_IDS.has(g.group_id)).flatMap((g) => g.types)))
  const typeIdsExpedition = Array.from(
    new Set(groups.filter((g) => EXPEDITION_BURST_GROUP_IDS.has(g.group_id)).flatMap((g) => g.types)),
  )

  const combatNameEntries: EsiNameEntry[] = []
  for (const ids of chunk(typeIdsCombat, 1000)) combatNameEntries.push(...(await postUniverseNames(ids)))

  const miningNameEntries: EsiNameEntry[] = []
  for (const ids of chunk(typeIdsMining, 1000)) miningNameEntries.push(...(await postUniverseNames(ids)))

  const expeditionNameEntries: EsiNameEntry[] = []
  for (const ids of chunk(typeIdsExpedition, 1000)) expeditionNameEntries.push(...(await postUniverseNames(ids)))

  const combat = combatNameEntries
    .filter((e) => e.category === 'inventory_type')
    .map((e) => ({ id: e.id, name: e.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const mining = miningNameEntries
    .filter((e) => e.category === 'inventory_type')
    .map((e) => ({ id: e.id, name: e.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const expedition = expeditionNameEntries
    .filter((e) => e.category === 'inventory_type')
    .map((e) => ({ id: e.id, name: e.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  saveCachedTypes(combat, mining, expedition)
  return { combat, mining, expedition }
}
