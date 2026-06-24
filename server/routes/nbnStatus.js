import fetch from 'node-fetch'

/* NBN Co publishes no public bulk-outage API — its official status tool is an
 * address-by-address lookup, not a feed (confirmed via live browser inspection).
 * This polls StatusGator's free API instead, which gives one binary national
 * up/down signal + a 30-day incident count for NBN as a monitored service —
 * not geographic, so it's surfaced as a header status badge, not a map layer.
 * Requires a free StatusGator account: sign up, create a board, add "NBN" as a
 * monitored service on it, generate a read-only API token, then set
 * STATUSGATOR_TOKEN and STATUSGATOR_BOARD_ID in .env. See TODO.md for the
 * full setup steps. */

const POLL_MS       = 10 * 60 * 1000
const FIRST_POLL_MS = 20_000
const HISTORY_DAYS  = 30
const API_BASE      = 'https://statusgator.com/api/v3'

async function statusGatorGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`StatusGator HTTP ${res.status} — ${path}`)
  const data = await res.json()
  if (data.success === false) throw new Error(data.message || `StatusGator API error — ${path}`)
  return data.data ?? []
}

export function findNbnMonitor(monitors) {
  return (monitors ?? []).find(m => /nbn/i.test(m?.name ?? ''))
}

export async function fetchNbnStatus(token, boardId) {
  const monitors = await statusGatorGet(`/boards/${boardId}/monitors`, token)
  const nbn = findNbnMonitor(monitors)
  if (!nbn) return null

  const monitorId = nbn.monitor_id ?? nbn.id
  const start = new Date()
  start.setDate(start.getDate() - HISTORY_DAYS)
  const startDate = start.toISOString().slice(0, 10)

  const history = monitorId
    ? await statusGatorGet(`/boards/${boardId}/history?start_date=${startDate}&monitor_id=${monitorId}`, token)
        .catch(err => { console.warn('[NBN STATUS] History fetch failed:', err.message); return [] })
    : []

  return {
    status:           nbn.status ?? 'unknown',
    name:             nbn.name,
    incidentCount30d: history.length,
    lastIncident:     history[0] ?? null,
    checkedAt:        new Date().toISOString(),
  }
}

export function startNbnStatusPoller(broadcast, store) {
  const token   = process.env.STATUSGATOR_TOKEN
  const boardId = process.env.STATUSGATOR_BOARD_ID

  if (!token || !boardId) {
    console.log('[NBN STATUS] STATUSGATOR_TOKEN/STATUSGATOR_BOARD_ID not set — skipping (see TODO.md for setup)')
    return
  }

  async function poll() {
    try {
      const result = await fetchNbnStatus(token, boardId)
      if (!result) {
        console.warn('[NBN STATUS] No monitor named "NBN" found on this StatusGator board — add it from your dashboard')
        setTimeout(poll, POLL_MS)
        return
      }
      store.nbnStatus = result
      broadcast('nbn_status', result)
      console.log(`[NBN STATUS] ${result.status} — ${result.incidentCount30d} incident(s) in last ${HISTORY_DAYS} days`)
    } catch (err) {
      console.warn('[NBN STATUS] Poll failed:', err.message)
    }
    setTimeout(poll, POLL_MS)
  }

  setTimeout(poll, FIRST_POLL_MS)
}
