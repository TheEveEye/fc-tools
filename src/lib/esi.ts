export type EsiInventoryType = {
  id: number
  name: string
}

type EsiUniverseIdsResponse = {
  inventory_types?: EsiInventoryType[]
}

const ESI_BASE = 'https://esi.evetech.net/latest'

function normalizeName(name: string): string {
  return name.trim().replaceAll(/\s+/g, ' ')
}

async function postUniverseIds(names: string[], signal: AbortSignal): Promise<EsiUniverseIdsResponse> {
  const response = await fetch(`${ESI_BASE}/universe/ids/?datasource=tranquility&language=en`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(names),
    signal,
  })

  if (!response.ok) {
    throw new Error(`ESI /universe/ids failed: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as EsiUniverseIdsResponse
}

export class InventoryTypeResolver {
  private readonly cache = new Map<string, EsiInventoryType | null>()

  getCached(name: string): EsiInventoryType | null | undefined {
    return this.cache.get(normalizeName(name).toLowerCase())
  }

  async resolveMany(names: string[]): Promise<Map<string, EsiInventoryType | null>> {
    const normalized = names.map(normalizeName).filter(Boolean)
    const uniqueNormalized = Array.from(new Set(normalized))

    const results = new Map<string, EsiInventoryType | null>()
    const toFetch: string[] = []

    for (const n of uniqueNormalized) {
      const key = n.toLowerCase()
      const cached = this.cache.get(key)
      if (cached !== undefined) {
        results.set(n, cached)
      } else {
        toFetch.push(n)
      }
    }

    if (toFetch.length === 0) return results

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10_000)

    try {
      const json = await postUniverseIds(toFetch, controller.signal)
      const found = json.inventory_types ?? []
      const byLowerName = new Map(found.map((t) => [t.name.toLowerCase(), t] as const))

      for (const n of toFetch) {
        const type = byLowerName.get(n.toLowerCase()) ?? null
        this.cache.set(n.toLowerCase(), type)
        results.set(n, type)
      }
    } finally {
      window.clearTimeout(timeout)
    }

    return results
  }
}
