import { useState, useCallback, useMemo } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import { X, Plus, LayoutGrid, GripHorizontal } from 'lucide-react'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGrid = WidthProvider(Responsive)

export const PANEL_META = {
  left:    { title: '⚙ MONITOR & WEATHER',  minW: 2, minH: 5 },
  map:     { title: '🗺 LIVE MAP',           minW: 5, minH: 6 },
  right:   { title: '💹 FINANCIAL',          minW: 3, minH: 5 },
  news:    { title: '📰 NEWS & AI BRIEF',    minW: 3, minH: 4 },
  fids:    { title: '✈ FIDS DEPARTURES',    minW: 3, minH: 3 },
  seismic: { title: '📡 SEISMIC ACTIVITY',  minW: 2, minH: 3 },
}

const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'left',  x: 0,  y: 0, w: 3,  h: 18, minW: 2, minH: 5 },
    { i: 'map',   x: 3,  y: 0, w: 14, h: 18, minW: 5, minH: 6 },
    { i: 'right', x: 17, y: 0, w: 7,  h: 18, minW: 3, minH: 5 },
  ],
  md: [
    { i: 'left',  x: 0,  y: 0, w: 3, h: 14, minW: 2, minH: 5 },
    { i: 'map',   x: 3,  y: 0, w: 9, h: 14, minW: 5, minH: 6 },
    { i: 'right', x: 12, y: 0, w: 4, h: 14, minW: 3, minH: 5 },
  ],
}

const DEFAULT_VISIBLE = ['left', 'map', 'right']
const STORAGE_KEY = 'au-monitor-layout-v1'

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}

function persist(layouts, visible) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ layouts, visible: [...visible] })) } catch {}
}

export default function DashboardGrid({ panels }) {
  const saved = useMemo(loadSaved, [])

  const [layouts,    setLayouts]    = useState(() => saved?.layouts   ?? DEFAULT_LAYOUTS)
  const [visible,    setVisible]    = useState(() => new Set(saved?.visible ?? DEFAULT_VISIBLE))
  const [pickerOpen, setPickerOpen] = useState(false)

  const handleLayoutChange = useCallback((_, all) => {
    setLayouts(all)
    persist(all, visible)
  }, [visible])

  const removePanel = useCallback(id => {
    setVisible(prev => {
      const next = new Set(prev)
      next.delete(id)
      persist(layouts, next)
      return next
    })
  }, [layouts])

  const addPanel = useCallback(id => {
    setVisible(prev => {
      const next = new Set([...prev, id])
      persist(layouts, next)
      return next
    })
    setPickerOpen(false)
  }, [layouts])

  const resetLayout = useCallback(() => {
    setLayouts(DEFAULT_LAYOUTS)
    setVisible(new Set(DEFAULT_VISIBLE))
    localStorage.removeItem(STORAGE_KEY)
    setPickerOpen(false)
  }, [])

  const visibleIds = [...visible].filter(id => panels[id])
  const hiddenIds  = Object.keys(PANEL_META).filter(id => !visible.has(id) && panels[id])

  return (
    <div className="dashboard-root">
      <ResponsiveGrid
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 800 }}
        cols={{ lg: 24, md: 16 }}
        rowHeight={38}
        margin={[4, 4]}
        containerPadding={[4, 4]}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".panel-handle"
        resizeHandles={['se', 's', 'e']}
      >
        {visibleIds.map(id => (
          <div key={id} className="au-panel">
            <div className="panel-handle">
              <GripHorizontal size={11} style={{ opacity: 0.35, flexShrink: 0 }} />
              <span className="panel-handle-title">{PANEL_META[id].title}</span>
              <button
                className="panel-close-btn"
                onClick={e => { e.stopPropagation(); removePanel(id) }}
                title="Close panel"
              >
                <X size={11} />
              </button>
            </div>
            <div className="panel-body">
              {panels[id]}
            </div>
          </div>
        ))}
      </ResponsiveGrid>

      {/* ── Floating panel manager button ── */}
      <button
        className="panel-fab"
        onClick={() => setPickerOpen(p => !p)}
        title="Add / manage panels"
      >
        <LayoutGrid size={15} />
      </button>

      {pickerOpen && (
        <div className="panel-picker">
          <div className="panel-picker-header">
            <LayoutGrid size={10} />
            PANELS
          </div>

          {hiddenIds.length > 0 && (
            <>
              <div className="panel-picker-section">ADD</div>
              {hiddenIds.map(id => (
                <button key={id} className="panel-picker-item" onClick={() => addPanel(id)}>
                  <Plus size={10} /> {PANEL_META[id].title}
                </button>
              ))}
            </>
          )}

          <div className="panel-picker-section" style={{ marginTop: hiddenIds.length ? 8 : 0 }}>
            VISIBLE
          </div>
          {[...visible].map(id => (
            <button key={id} className="panel-picker-item active" onClick={() => removePanel(id)}>
              <X size={10} /> {PANEL_META[id].title}
            </button>
          ))}

          <div className="panel-picker-divider" />
          <button className="panel-picker-reset" onClick={resetLayout}>
            Reset to default layout
          </button>
        </div>
      )}
    </div>
  )
}
