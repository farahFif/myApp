import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LanguageSelect() {
  const [langs, setLangs] = useState(null) // null = loading, [] = none
  const [err, setErr] = useState(null)
  const navigate = useNavigate()
  const base = import.meta.env.BASE_URL || '/'

  useEffect(() => {
    fetch(`${base}data/languages.json`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setLangs)
      .catch(e => {
        console.error('languages.json fetch failed:', e)
        setErr(e.message)
        setLangs([])
      })
  }, [base])

  const start = (code) => navigate(`/task/${encodeURIComponent(code)}/0`)

  return (
    <section className="card">
      <h2>Select language</h2>
      {langs === null && <p>Loading languages…</p>}
      {langs && langs.length === 0 && (
        <p>
          No languages found. Make sure <code>public/data/languages.json</code> exists
          and is valid JSON. {err && <span>({err})</span>}
        </p>
      )}
      {langs && langs.length > 0 && (
        <ul className="lang-grid">
          {langs.map(({ code, name }) => (
            <li key={code}>
              <button className="btn" onClick={() => start(code)}>{name}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
