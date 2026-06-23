import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

const STATE_ABBR = {
  1: 'NSW', 2: 'VIC', 3: 'QLD', 4: 'SA', 5: 'WA', 6: 'TAS', 7: 'NT', 8: 'ACT', 9: 'OT',
}

/** Suburb/area search box — queries ABS SA2 boundaries by name and flies the map to the match on select. */
export default function SuburbSearch({ onSelect }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen]   = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([])
      setIsOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/boundaries/search?q=${encodeURIComponent(query.trim())}`)
        const geojson = await res.json()
        setResults(res.ok ? (geojson.features ?? []) : [])
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
        setIsOpen(true)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  const handleSelect = feature => {
    onSelect(feature)
    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  return (
    <div className="suburb-search">
      <div className="suburb-search-input-wrap">
        <Search size={12} className="suburb-search-icon" />
        <input
          className="suburb-search-input"
          type="text"
          placeholder="Search suburb or area…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={e => { if (e.key === 'Escape') setIsOpen(false) }}
        />
      </div>

      {isOpen && (
        <div className="suburb-search-results">
          {isLoading && <div className="suburb-search-empty">Searching…</div>}
          {!isLoading && results.length === 0 && (
            <div className="suburb-search-empty">No suburbs found</div>
          )}
          {!isLoading && results.map(f => (
            <div
              key={f.properties.sa2_code_2021}
              className="suburb-search-result"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleSelect(f)}
            >
              {f.properties.sa2_name_2021}
              <span className="state-tag">{STATE_ABBR[f.properties.state_code_2021] ?? ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
