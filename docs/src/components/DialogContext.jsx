import { useEffect, useState } from 'react'
import { loadDialogContext, saveDialogContext, clearDialogContext } from '../utils/storage.js'

const FORMALITY = ['Very informal', 'Informal', 'Neutral', 'Formal', 'Very formal']
const LOC_DOMAIN = ['Personal', 'Professional']
const LOC_PRIVACY = ['Private', 'Public']

export default function DialogContext({ lang, taskId }) {
  const [state, setState] = useState(() => ({
    socialSetting: '',
    locationDomain: [],  // Personal / Professional (multi)
    locationPrivacy: [], // Private / Public (multi)
    formality: '',       // one of FORMALITY
  }))

  useEffect(() => {
    const saved = loadDialogContext(lang, taskId)
    if (saved) setState(prev => ({ ...prev, ...saved }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, taskId])

  useEffect(() => {
    saveDialogContext(lang, taskId, state)
  }, [lang, taskId, state])

  const update = (e) => {
    const { name, value } = e.target
    setState(s => ({ ...s, [name]: value }))
  }

  const toggleArray = (key, val, checked) => {
    setState(s => {
      const set = new Set(s[key] || [])
      if (checked) set.add(val); else set.delete(val)
      return { ...s, [key]: Array.from(set) }
    })
  }

  const reset = () => {
    if (!confirm('Clear Dialog context for this task?')) return
    clearDialogContext(lang, taskId)
    setState({
      socialSetting: '',
      locationDomain: [],
      locationPrivacy: [],
      formality: '',
    })
  }

  return (
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <h3 style={{ margin: 0 }}>Dialog context</h3>
        <button className="btn ghost" onClick={reset}>Reset</button>
      </div>

      <div className="form-grid" style={{ marginTop: 10 }}>
        <label style={{ gridColumn: 'span 2' }}>
          <strong>Social setting</strong>
          <input
            name="socialSetting"
            value={state.socialSetting}
            onChange={update}
            placeholder="e.g., family dinner, job interview, hospital waiting room…"
          />
        </label>

        <fieldset className="fieldset">
          <legend><strong>Location (Domain)</strong></legend>
          <div className="row" style={{ flexWrap:'wrap', gap:12 }}>
            {LOC_DOMAIN.map(opt => (
              <label key={opt} className="radio" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <input
                  type="checkbox"
                  checked={state.locationDomain.includes(opt)}
                  onChange={(e) => toggleArray('locationDomain', opt, e.target.checked)}
                />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend><strong>Location (Privacy)</strong></legend>
          <div className="row" style={{ flexWrap:'wrap', gap:12 }}>
            {LOC_PRIVACY.map(opt => (
              <label key={opt} className="radio" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <input
                  type="checkbox"
                  checked={state.locationPrivacy.includes(opt)}
                  onChange={(e) => toggleArray('locationPrivacy', opt, e.target.checked)}
                />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>

        <div style={{ gridColumn: 'span 2' }}>
          <strong style={{ display:'block', marginBottom: 6 }}>Dialogue formality</strong>
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' }}>
            {FORMALITY.map(level => (
              <label key={level} className="radio" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <input
                  type="radio"
                  name="formality"
                  value={level}
                  checked={state.formality === level}
                  onChange={update}
                />
                {level}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
