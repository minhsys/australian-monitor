const PANELS = [
  { id: 'map',   label: 'MAP' },
  { id: 'left',  label: 'MONITOR' },
  { id: 'right', label: 'MARKETS' },
]

export default function MobileNav({ active, onChange }) {
  return (
    <nav className="mobile-nav">
      {PANELS.map(p => (
        <button
          key={p.id}
          className={`mobile-nav-btn${active === p.id ? ' active' : ''}`}
          onClick={() => onChange(p.id)}
        >
          {p.label}
        </button>
      ))}
    </nav>
  )
}
