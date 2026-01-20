import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { COMMAND_LINK_GROUPS, allCommandLinkKeys } from './lib/commandLinks'
import { fetchCommandBurstShipTypes } from './lib/commandBurstShips'
import { InventoryTypeResolver, type EsiInventoryType } from './lib/esi'
import { eveTypeIconUrl, eveTypeRenderUrl } from './lib/eveImages'
import { decodeStateFromHash, encodeStateToHash, type AppState } from './lib/state'

function App() {
  const resolver = useMemo(() => new InventoryTypeResolver(), [])

  const defaultState = useMemo<AppState>(() => {
    const selections: AppState['selections'] = {}
    for (const key of allCommandLinkKeys()) selections[key] = { enabled: false, shipsText: '', mindlink: false }
    return { selections }
  }, [])

  const normalizeState = useCallback(
    (input: AppState | null): AppState => {
      const selections: AppState['selections'] = {}
      for (const key of allCommandLinkKeys()) {
        const sel = input?.selections?.[key]
        selections[key] = {
          enabled: Boolean(sel?.enabled),
          shipsText: sel?.shipsText ?? '',
          mindlink: Boolean(sel?.mindlink),
        }
      }
      return { ...defaultState, selections }
    },
    [defaultState],
  )

  const [state, setState] = useState<AppState>(() => {
    const fromHash = decodeStateFromHash(window.location.hash)
    if (fromHash) return normalizeState(fromHash)

    const raw = window.localStorage.getItem('fc-tools.command-links.state.v1')
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AppState
        return normalizeState(parsed)
      } catch {
        // ignore
      }
    }

    return defaultState
  })

  const [linkTypeByKey, setLinkTypeByKey] = useState<Record<string, EsiInventoryType | null>>({})
  const [shipTypeByName, setShipTypeByName] = useState<Record<string, EsiInventoryType | null>>({})
  const [esiError, setEsiError] = useState<string | null>(null)
  const [shipTypesAll, setShipTypesAll] = useState<EsiInventoryType[]>([])
  const [shipTypesMining, setShipTypesMining] = useState<EsiInventoryType[]>([])
  const [focusedLinkKey, setFocusedLinkKey] = useState<string | null>(null)

  useEffect(() => {
    window.localStorage.setItem('fc-tools.command-links.state.v1', JSON.stringify(state))
  }, [state])

  const updateSelection = useCallback((key: string, patch: Partial<AppState['selections'][string]>) => {
    setState((prev) => ({
      ...prev,
      selections: {
        ...prev.selections,
        [key]: {
          ...prev.selections[key],
          ...patch,
        },
      },
    }))
  }, [])

  const resolveShipsFromText = useCallback(
    async (text: string) => {
      const names = text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      if (names.length === 0) return

      try {
        setEsiError(null)
        const resolved = await resolver.resolveMany(names)
        setShipTypeByName((prev) => {
          const next = { ...prev }
          for (const [name, type] of resolved.entries()) next[name.toLowerCase()] = type
          return next
        })
      } catch (e) {
        setEsiError(e instanceof Error ? e.message : 'Failed to reach ESI')
      }
    },
    [resolver],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { all, mining } = await fetchCommandBurstShipTypes()
        if (cancelled) return
        setShipTypesAll(all)
        setShipTypesMining(mining)
        setShipTypeByName((prev) => {
          const next = { ...prev }
          for (const t of all) next[t.name.toLowerCase()] = t
          return next
        })
      } catch {
        // keep UI clean: ship dropdown is optional
        if (!cancelled) {
          setShipTypesAll([])
          setShipTypesMining([])
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const names = COMMAND_LINK_GROUPS.flatMap((g) => g.links.map((l) => l.eveTypeName).filter(Boolean)) as string[]
    if (names.length === 0) return

    let cancelled = false
    ;(async () => {
      try {
        setEsiError(null)
        const resolved = await resolver.resolveMany(names)
        const next: Record<string, EsiInventoryType | null> = {}
        for (const group of COMMAND_LINK_GROUPS) {
          for (const link of group.links) {
            if (!link.eveTypeName) continue
            next[link.key] = resolved.get(link.eveTypeName) ?? null
          }
        }
        if (!cancelled) setLinkTypeByKey(next)
      } catch (e) {
        if (!cancelled) setEsiError(e instanceof Error ? e.message : 'Failed to reach ESI')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [resolver])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const names = Object.values(state.selections)
        .filter((s) => s.enabled)
        .flatMap((s) =>
          s.shipsText
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        )

      const unique = Array.from(new Set(names))
      const missing = unique.filter((n) => shipTypeByName[n.toLowerCase()] === undefined)
      if (missing.length === 0) return
      void resolveShipsFromText(missing.join(','))
    }, 500)

    return () => window.clearTimeout(timer)
  }, [resolveShipsFromText, shipTypeByName, state.selections])

  const summaryText = useMemo(() => {
    const lines: string[] = []
    for (const group of COMMAND_LINK_GROUPS) {
      const enabledLinks = group.links.filter((l) => state.selections[l.key]?.enabled)
      if (enabledLinks.length === 0) continue

      lines.push(`[${group.name}]`)
      for (const link of enabledLinks) {
        const selection = state.selections[link.key]
        const text = selection?.shipsText ?? ''
        const ships = text
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => shipTypeByName[s.toLowerCase()]?.name ?? s)

        const mindlink = selection?.mindlink ? ' (Mindlink)' : ''
        lines.push(`${link.label}${mindlink}: ${ships.length ? ships.join(', ') : '-'}`)
      }
      lines.push('')
    }
    return lines.join('\n').trim()
  }, [shipTypeByName, state.selections])

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="title">Command Link Sorter</h1>
          <p className="subtitle">
            Tick the bursts you have, then type ship types (comma-separated). Icons come from EVE&apos;s image server.
          </p>
          {esiError ? <p className="error">ESI: {esiError}</p> : null}
        </div>
        <div className="headerActions">
          <button
            type="button"
            onClick={() => {
              setState(defaultState)
              window.location.hash = ''
            }}
          >
            Reset
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="groups">
          {COMMAND_LINK_GROUPS.map((group) => (
            <div key={group.name} className="groupCard">
              <h2 className="groupTitle">{group.name}</h2>
              <div className="rows">
                {group.links.map((link) => {
                  const selection = state.selections[link.key]
                  const linkType = linkTypeByKey[link.key]
                  const query = selection.shipsText.split(',').at(-1)?.trim() ?? ''
                  const showSuggestions = selection.enabled && focusedLinkKey === link.key && query.length > 0
                  const eligibleShipTypes = group.name === 'Mining' ? shipTypesMining : shipTypesAll
                  const suggestions = showSuggestions
                    ? eligibleShipTypes
                        .filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
                        .slice(0, 12)
                    : []

                  const shipParts = selection.shipsText
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)

                  if (!selection.shipsText.trimEnd().endsWith(',')) shipParts.pop()

                  const ships = shipParts
                    .map((s) => ({ raw: s, resolved: shipTypeByName[s.toLowerCase()] ?? null }))

                  return (
                    <div key={link.key} className={`row ${selection.enabled ? 'rowEnabled' : ''}`}>
                      <label className="left">
                        <input
                          type="checkbox"
                          checked={selection.enabled}
                          onChange={(e) => updateSelection(link.key, { enabled: e.target.checked })}
                        />
                        {linkType?.id ? (
                          <img
                            className="icon"
                            src={eveTypeIconUrl(linkType.id, 64)}
                            alt={`${link.label} icon`}
                            loading="lazy"
                          />
                        ) : (
                          <div className="iconPlaceholder" aria-hidden="true" />
                        )}
                        <span className="labelText">{link.label}</span>
                      </label>

                      <div className="right">
                        <div className="rowControls">
                          <label className="mindlinkToggle">
                            <input
                              type="checkbox"
                              checked={selection.mindlink}
                              onChange={(e) => updateSelection(link.key, { mindlink: e.target.checked })}
                              disabled={!selection.enabled}
                            />
                            Mindlink
                          </label>
                        </div>

                        <div className="shipField">
                          <input
                            className="shipInput"
                            value={selection.shipsText}
                            placeholder="Ship types (e.g. Claymore, Damnation)"
                            onChange={(e) => updateSelection(link.key, { shipsText: e.target.value })}
                            onFocus={() => setFocusedLinkKey(link.key)}
                            onBlur={(e) => {
                              setFocusedLinkKey(null)
                              void resolveShipsFromText(e.target.value)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur()
                              }
                            }}
                            disabled={!selection.enabled}
                            autoComplete="off"
                          />
                          {suggestions.length ? (
                            <div className="suggestions" role="listbox" aria-label="Ship type suggestions">
                              {suggestions.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  className="suggestion"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    const parts = selection.shipsText.split(',')
                                    const last = parts.pop() ?? ''
                                    const leading = last.match(/^\s*/)?.[0] ?? ''
                                    const prefix = parts.length ? `${parts.join(',')},` : ''
                                    const nextText = `${prefix}${leading}${t.name}, `
                                    updateSelection(link.key, { shipsText: nextText })
                                  }}
                                >
                                  <img
                                    className="suggestionImg"
                                    src={eveTypeRenderUrl(t.id, 64)}
                                    alt=""
                                    loading="lazy"
                                  />
                                  <span className="suggestionText">{t.name}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="chips" aria-label="Resolved ship types">
                          {ships.map((s) => (
                            <div key={s.raw} className={`chip ${s.resolved ? '' : 'chipUnknown'}`}>
                              {s.resolved?.id ? (
                                <img
                                  className="chipImg"
                                  src={eveTypeRenderUrl(s.resolved.id, 64)}
                                  alt={s.resolved.name}
                                  loading="lazy"
                                />
                              ) : null}
                              <span className="chipText">{s.resolved?.name ?? s.raw}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        <aside className="summaryCard">
          <h2 className="groupTitle">Summary</h2>
          <textarea className="summaryText" readOnly value={summaryText || 'Tick some links to build a summary…'} />
          <div className="summaryActions">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(summaryText)
              }}
              disabled={!summaryText}
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => {
                const hash = encodeStateToHash(state)
                const url = `${window.location.origin}${window.location.pathname}#${hash}`
                window.location.hash = hash
                void navigator.clipboard.writeText(url)
              }}
            >
              Copy Share Link
            </button>
          </div>
          <p className="hint">
            Tip: pick ship types from the dropdown (or type them), then press Enter (or click outside) to resolve names.
          </p>
        </aside>
      </main>
    </div>
  )
}

export default App
