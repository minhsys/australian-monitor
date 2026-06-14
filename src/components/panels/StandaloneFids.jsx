export default function StandaloneFids({ fids }) {
  const airports = Object.values(fids || {})

  if (!airports.length) {
    return (
      <div style={{ padding: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        Waiting for FIDS data…
      </div>
    )
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      <div style={{ color: 'var(--accent-cyan)', fontSize: 9, letterSpacing: 2, marginBottom: 8 }}>
        MAJOR AIRPORT DEPARTURES
      </div>
      {airports.map(a => (
        <div
          key={a.iata}
          style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}
        >
          <span style={{ color: 'var(--text-primary)', width: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.iata} — {a.name}
          </span>
          <span>DEP <span style={{ color: 'var(--accent-blue)' }}>{a.departures}</span></span>
          <span>DLY <span style={{ color: a.delayed > 5 ? 'var(--accent-red)' : 'var(--accent-orange)' }}>{a.delayed}</span></span>
        </div>
      ))}
    </div>
  )
}
