import { useLocation } from 'react-router-dom'
import { useMemo } from 'react'

export default function Layout({ children }) {
  const location = useLocation()

  // Detect /task/:lang/:index and show "Task N"
  const taskLabel = useMemo(() => {
    const m = location.pathname.match(/\/task\/[^/]+\/(\d+)(?:\/|$)/)
    if (!m) return ''
    const idx = Number(m[1])
    return Number.isFinite(idx) ? `Task ${idx + 1}` : ''
  }, [location.pathname])

  return (
    <div className="container">
      <header className="header" style={{ textAlign: 'center', marginBottom: 16 }}>
        <h1
          style={{
            marginBottom: 6,
            fontSize: '1.8rem',
            color: '#16537E',
            fontWeight: 800,
            letterSpacing: '0.5px',
          }}
        >
          Annotation Project
        </h1>
        {taskLabel && (
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: '#007bff',
              marginTop: 4,
            }}
          >
            {taskLabel}
          </div>
        )}
      </header>

      <main className="main">{children}</main>

      <footer className="footer" style={{ textAlign: 'center', marginTop: 20 }}>
        GitHub Pages ready · React + Vite
      </footer>
    </div>
  )
}
