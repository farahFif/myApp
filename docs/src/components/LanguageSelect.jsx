import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LanguageSelect() {
  const navigate = useNavigate()
  const base = import.meta.env.BASE_URL || '/'

  const [catalog, setCatalog] = useState({})
  const [selectedLang, setSelectedLang] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadCatalog() {
      try {
        const res = await fetch(`${base}data/catalog.json`, { cache: 'no-cache' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) setCatalog(data || {})
      } catch (e) {
        console.error('catalog.json fetch failed:', e)
        if (!cancelled) setError('Could not load catalog.json. Check public/data/catalog.json')
      }
    }
    loadCatalog()
    return () => { cancelled = true }
  }, [base])

  const languages = useMemo(() => Object.keys(catalog || {}).sort(), [catalog])
  const movies = useMemo(() => {
    if (!selectedLang) return []
    return Array.isArray(catalog[selectedLang]) ? catalog[selectedLang] : []
  }, [catalog, selectedLang])

  const startMovie = (lang, movieId) => {
    navigate(`/task/${encodeURIComponent(lang)}/${encodeURIComponent(movieId)}/0`)
  }

  return (
    <div className="card">
      <h2>Select language</h2>

      {error && <p style={{ color: '#b22222' }}>{error}</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
        {languages.map((lang) => (
          <button
            key={lang}
            className="btn"
            onClick={() => setSelectedLang(lang)}
            style={selectedLang === lang ? { outline: '2px solid #16537E' } : {}}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      {selectedLang && (
        <div style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 6 }}>Select movie</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Choose which movie you want to annotate for {selectedLang.toUpperCase()}.
          </p>

          {movies.length === 0 ? (
            <p className="muted">No movies found for this language in catalog.json.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {movies.map((m) => (
                <button
                  key={m.id}
                  className="btn ghost"
                  onClick={() => startMovie(selectedLang, m.id)}
                  title={m.file || ''}
                >
                  {m.title || m.id}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
