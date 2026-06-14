export default function StandaloneSeismic({ seismic }) {
  const events = (seismic || []).slice(0, 12)

  if (!events.length) {
    return (
      <div style={{ padding: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        No seismic events
      </div>
    )
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '6px 10px' }}>
      <div style={{ color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2, marginBottom: 8 }}>
        RECENT SEISMIC ACTIVITY
      </div>
      {events.map((e, i) => (
        <div key={e.id ?? i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 12, flexShrink: 0 }}>📡</span>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              M{e.magnitude?.toFixed(1)} — {e.place}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              Depth: {e.depth}km
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
