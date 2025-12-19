import { useEffect, useState } from 'react'
import { loadDialogContext, saveDialogContext } from '../utils/storage.js'

const FORMALITY = ['Very informal', 'Informal', 'Neutral', 'Formal', 'Very formal']

export default function DialogContext({ lang, taskId, onDirty }) {
  const [state, setState] = useState(() => ({
    socialSetting: '',
    locationDomain: '',   // 'Personal' | 'Professional'
    locationPrivacy: '',  // 'Private' | 'Public'
    formality: '',
  }))

  // Load from storage on mount / lang / task change
  useEffect(() => {
    const saved = loadDialogContext(lang, taskId)
    if (saved) {
      setState({
        socialSetting: saved.socialSetting || '',
        locationDomain: Array.isArray(saved.locationDomain)
          ? saved.locationDomain[0] || ''
          : saved.locationDomain || '',
        locationPrivacy: Array.isArray(saved.locationPrivacy)
          ? saved.locationPrivacy[0] || ''
          : saved.locationPrivacy || '',
        formality: saved.formality || '',
      })
    } else {
      setState({
        socialSetting: '',
        locationDomain: '',
        locationPrivacy: '',
        formality: '',
      })
    }
  }, [lang, taskId])

  // Autosave + notify parent
  useEffect(() => {
    const payload = {
      socialSetting: state.socialSetting,
      locationDomain: state.locationDomain,
      locationPrivacy: state.locationPrivacy,
      formality: state.formality,
    }
    saveDialogContext(lang, taskId, payload)
    if (onDirty) onDirty()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lang, taskId])

  const update = (patch) =>
    setState((s) => ({
      ...s,
      ...patch,
    }))

  return (
    <div className="card">
      <h3>Dialogue Context</h3>
      <p className="muted">
        Describe where and in what kind of situation this dialogue is happening.
      </p>

      <div className="form-grid" style={{ marginTop: 8 }}>
        <label style={{ gridColumn: '1 / -1' }}>
          <strong>Social setting</strong>
          <textarea
            value={state.socialSetting}
            onChange={(e) => update({ socialSetting: e.target.value })}
            rows={3}
            placeholder="e.g., family dinner, workplace meeting, classroom, online chat..."
          />
        </label>

        {/* Location Domain & Privacy side by side */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            gridColumn: '1 / -1',
            marginTop: 4,
          }}
        >
          <div>
            <strong>Location domain</strong>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 4,
                flexWrap: 'wrap',
              }}
            >
              {['Personal', 'Professional'].map((opt) => (
                <label key={opt} className="radio">
                  <input
                    type="radio"
                    name={`loc-domain-${lang}-${taskId}`}
                    value={opt}
                    checked={state.locationDomain === opt}
                    onChange={(e) => update({ locationDomain: e.target.value })}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div>
            <strong>Location privacy</strong>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 4,
                flexWrap: 'wrap',
              }}
            >
              {['Private', 'Public'].map((opt) => (
                <label key={opt} className="radio">
                  <input
                    type="radio"
                    name={`loc-privacy-${lang}-${taskId}`}
                    value={opt}
                    checked={state.locationPrivacy === opt}
                    onChange={(e) => update({ locationPrivacy: e.target.value })}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Formality */}
        <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
          <strong>Dialogue formality</strong>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 4,
            }}
          >
            {FORMALITY.map((level) => (
              <label key={level} className="radio">
                <input
                  type="radio"
                  name={`formality-${lang}-${taskId}`}
                  value={level}
                  checked={state.formality === level}
                  onChange={(e) => update({ formality: e.target.value })}
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
