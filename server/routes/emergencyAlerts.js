import {
  fetchNswRfs, fetchVicEmergency, fetchQldQfes, fetchSaCfs, fetchWaDfes, fetchTasTfs, fetchActEsa,
} from './emergencyAlertSources.js'

const POLL_MS = 5 * 60 * 1000

const SOURCES = [
  ['NSW RFS',  fetchNswRfs],
  ['VIC EMV',  fetchVicEmergency],
  ['QLD QFES', fetchQldQfes],
  ['SA CFS',   fetchSaCfs],
  ['WA DFES',  fetchWaDfes],
  ['TAS TFS',  fetchTasTfs],
  ['ACT ESA',  fetchActEsa],
]

export function startEmergencyAlertsPoller(broadcast, store) {
  async function poll() {
    const results = await Promise.allSettled(SOURCES.map(([, fetcher]) => fetcher()))

    const alerts = []
    let failedCount = 0
    results.forEach((result, i) => {
      const [label] = SOURCES[i]
      if (result.status === 'fulfilled') {
        alerts.push(...result.value)
      } else {
        failedCount++
        console.warn(`[EMERGENCY ALERTS] ${label} poll failed:`, result.reason?.message)
      }
    })

    store.emergencyAlerts = alerts
    broadcast('emergency_alerts', alerts)
    console.log(`[EMERGENCY ALERTS] ${alerts.length} active incident(s) across ${SOURCES.length - failedCount}/${SOURCES.length} agencies`)
  }

  poll()
  setInterval(poll, POLL_MS)
}
