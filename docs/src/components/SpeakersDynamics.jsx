import { useEffect, useMemo, useState } from 'react'
import { loadDynamics, saveDynamics, clearDynamics } from '../utils/storage.js'

const CATEGORIES = {
  Family: [
    'parent of', 'child of',
    'sibling of', 'fiancé of', 'distant family member of',
    'grandparent of', 'grandchild of',
    'uncle of', 'aunt of', 'nephew/niece of',
    'cousin of', 'Other'
  ],
  Social: [
    'neighbour of', 'friend of', 'lover of', 'ex-lover of', 'enemy of',
    'idol of', 'member of same club as', 'Other'
  ],
  Professional: [
    'boss of','employee of','employer of',
    'teacher of','student of',
    'doctor of','patient of',
    'seller to','client of',
    'colleague of','classmate of',
    'religious relationship with','Other'
  ],
  Other: ['Other']
}

const FAMILIARITY = [
  'Stranger','Acquaintance','Minimal familiarity',
  'Somewhat familiar','Moderate familiarity','Intimate/very high'
]

const POWER_TYPES = [
  'Coercive','Reward-based','Legitimate/Legal','Expert',
  'Referent/Charismatic','Informational','Ideological'
]
const POWER_DIFF = ['High power','Equal power','Less power','Neutral']
const SOCIAL_DIFF = ['Higher status','Equal status','Lower status','Neutral']
const ACCOM_LEVELS = ['Divergent', 'Neutral', 'Convergent']

function edgeKey(a, b) { return `${a}→${b}` }
function pairKey(a, b) {
  const [A, B] = [a, b].map(String).sort((x, y) => x.localeCompare(y))
  return `${A} | ${B}`
}
function isLegacySymmetricKey(k) { return k.includes('|') && !k.includes('→') }

export default function SpeakersDynamics({ lang, taskId, speakers = [] }) {
  // speakers now comes from Profiles (TaskPage computes it)
  const [state, setState] = useState(() => ({
    speakers: speakers,
    edges: {},   // directed A→B data
    powers: {},  // per-speaker selected power types
    intents: {}, // symmetric intentions alignment
  }))

  // Load and migrate saved state
  useEffect(() => {
    const saved = loadDynamics(lang, taskId)
    if (saved) {
      let edges = saved.edges || saved.pairs || {}
      const migratedEdges = {}
      const intents = saved.intents ? { ...saved.intents } : {}
      for (const [k, v] of Object.entries(edges)) {
        if (isLegacySymmetricKey(k)) {
          const [A, B] = k.split('|')
          const payload = {
            category: v.category || '',
            relation: v.relation || '',
            familiarity: v.familiarity || ''
          }
          migratedEdges[edgeKey(A, B)] = { ...payload }
          migratedEdges[edgeKey(B, A)] = { ...payload }
        } else migratedEdges[k] = v
      }
      const powers = saved.powers || {}
      setState({ speakers, edges: migratedEdges, powers, intents })
      // save back migrated shape
      saveDynamics(lang, taskId, { speakers, edges: migratedEdges, powers, intents })
    } else {
      setState({ speakers, edges: {}, powers: {}, intents: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, taskId])

  // Keep state.speakers synced with prop speakers (from Profiles)
  useEffect(() => {
    setState(s => {
      // prune edges/powers/intents referencing removed speakers
      const setNames = new Set(speakers)
      const prunedEdges = {}
      for (const [k, v] of Object.entries(s.edges)) {
        const [A, B] = k.split('→')
        if (setNames.has(A) && setNames.has(B)) prunedEdges[k] = v
      }
      const prunedPowers = {}
      for (const name of Object.keys(s.powers || {})) {
        if (setNames.has(name)) prunedPowers[name] = s.powers[name]
      }
      const prunedIntents = {}
      for (const [pk, val] of Object.entries(s.intents || {})) {
        const [A, B] = pk.split(' | ')
        if (setNames.has(A) && setNames.has(B)) prunedIntents[pk] = val
      }
      return { speakers, edges: prunedEdges, powers: prunedPowers, intents: prunedIntents }
    })
  }, [speakers])

  // Autosave
  useEffect(() => { saveDynamics(lang, taskId, state) }, [state, lang, taskId])

  const directedPairs = useMemo(() => {
    const s = state.speakers.map(v => v.trim()).filter(Boolean)
    const out = []
    for (let i = 0; i < s.length; i++) for (let j = 0; j < s.length; j++) {
      if (i === j) continue
      const A = s[i], B = s[j]
      out.push({ A, B, k: edgeKey(A, B) })
    }
    return out
  }, [state.speakers])

  const unorderedPairs = useMemo(() => {
    const s = state.speakers.map(v => v.trim()).filter(Boolean).sort((a,b)=>a.localeCompare(b))
    const out = []
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
      const A = s[i], B = s[j], pk = pairKey(A,B)
      out.push({ A, B, pk })
    }
    return out
  }, [state.speakers])

  const setEdge = (k, patch) => {
    setState(s => ({ ...s, edges: { ...s.edges, [k]: { ...(s.edges[k] || {}), ...patch } } }))
  }

  const ensurePowerObj = (speaker) => {
    if (!state.powers[speaker]) {
      setState(s => ({ ...s, powers: { ...s.powers, [speaker]: { selected: [] } } }))
      return { selected: [] }
    }
    return state.powers[speaker]
  }
  const toggleSpeakerPower = (speaker, power, checked) => {
    const cur = ensurePowerObj(speaker)
    const selected = new Set(cur.selected || [])
    if (checked) selected.add(power); else selected.delete(power)
    setState(s => ({ ...s, powers: { ...s.powers, [speaker]: { selected: Array.from(selected) } } }))
  }
  const sourcePowers = (A) => state.powers[A]?.selected || []

  const resetAll = () => {
    clearDynamics(lang, taskId)
    setState({ speakers, edges: {}, powers: {}, intents: {} })
  }

  return (
    <div className="card" style={{ width:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <h3 style={{ margin: 0 }}>Speakers Dynamics</h3>
        <button className="btn ghost" onClick={resetAll}>Reset</button>
      </div>

      {/* Speaker Powers */}
      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0, marginBottom: 8 }}><strong>Speaker Powers (select types per speaker)</strong></h4>
        {state.speakers.length === 0 ? (
          <p className="muted">Create profiles to annotate powers.</p>
        ) : (
          <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {state.speakers.map((sp) => {
              const po = state.powers[sp] || { selected: [] }
              const openId = `powers-${sp}`
              return (
                <div key={sp} className="card" style={{ padding: 12 }}>
                  <strong>{sp}</strong>
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor:'pointer' }}><strong>Select powers</strong></summary>
                    <div className="row" style={{ marginTop: 8, flexWrap:'wrap', gap:8 }}>
                      {POWER_TYPES.map(pt => {
                        const checked = (po.selected || []).includes(pt)
                        const id = `${openId}-${pt}`
                        return (
                          <label key={id} className="radio" style={{ marginRight: 8 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleSpeakerPower(sp, pt, e.target.checked)}
                            /> {pt}
                          </label>
                        )
                      })}
                    </div>
                  </details>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Directed relationships/cards */}
      {directedPairs.length === 0 ? (
        <p style={{ marginTop: 12 }}>Create at least two profiles to annotate relationships.</p>
      ) : (
        <div style={{ marginTop: 12, display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))' }}>
          {directedPairs.map(({ A, B, k }) => {
            const e = state.edges[k] || {}
            const category = e.category || ''
            const relation = e.relation || ''
            const familiarity = e.familiarity || ''
            const powerDiff = e.powerDiff || ''
            const socialDiff = e.socialDiff || ''
            const accommodation = e.accommodation || ''
            const powersToCompare = sourcePowers(A)

            return (
              <div key={k} className="card" style={{ borderRadius: 12 }}>
                <strong>{A} → {B}</strong>

                <div className="form-grid" style={{ marginTop: 10 }}>
                  <label>
                    <strong>Category</strong>
                    <select
                      value={category}
                      onChange={(ev) => setEdge(k, { category: ev.target.value, relation: '' })}
                    >
                      <option value="" disabled>Select…</option>
                      {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>

                  <label>
                      <strong>Relationship</strong>
                      {category === 'Other' ? (
                        <input
                          type="text"
                          placeholder="Specify relationship"
                          value={relation}
                          onChange={(ev) => setEdge(k, { relation: ev.target.value })}
                        />
                      ) : (
                        <select
                          value={relation}
                          onChange={(ev) => setEdge(k, { relation: ev.target.value })}
                          disabled={!category}
                        >
                          <option value="" disabled>{category ? 'Select…' : 'Choose category first'}</option>
                          {category && CATEGORIES[category].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      )}
                    </label>
                                      <label>
                    <strong>Familiarity (A → B)</strong>
                    <select
                      value={familiarity}
                      onChange={(ev) => setEdge(k, { familiarity: ev.target.value })}
                    >
                      <option value="" disabled>Select…</option>
                      {FAMILIARITY.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </label>

                  <div style={{ gridColumn:'span 2' }}>
                    <strong>Overall power difference ({A} vs {B})</strong>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
                      {POWER_DIFF.map(opt => (
                        <label key={`${k}-pd-${opt}`} className="radio">
                          <input
                            type="radio"
                            name={`powdiff-${k}`}
                            value={opt}
                            checked={powerDiff === opt}
                            onChange={(e) => setEdge(k, { powerDiff: e.target.value })}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ gridColumn:'span 2' }}>
                    <strong>Overall social status difference ({A} vs {B})</strong>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
                      {SOCIAL_DIFF.map(opt => (
                        <label key={`${k}-sd-${opt}`} className="radio">
                          <input
                            type="radio"
                            name={`socialdiff-${k}`}
                            value={opt}
                            checked={socialDiff === opt}
                            onChange={(e) => setEdge(k, { socialDiff: e.target.value })}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ gridColumn:'span 2' }}>
                    <strong>Communication accommodation ({A} → {B})</strong>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
                      {ACCOM_LEVELS.map(level => (
                        <label key={`${k}-accom-${level}`} className="radio">
                          <input
                            type="radio"
                            name={`accom-${k}`}
                            value={level}
                            checked={accommodation === level}
                            onChange={(e) => setEdge(k, { accommodation: e.target.value })}
                          />
                          {level}
                        </label>
                      ))}
                    </div>
                  </div>

                  {powersToCompare.length > 0 && (
                    <div style={{ gridColumn:'span 2', marginTop: 8 }}>
                      <strong>Power comparisons by type ({A} vs {B})</strong>
                      <div style={{ display:'grid', gap: 8 }}>
                        {powersToCompare.map(pt => {
                          const val = (state.edges[k]?.powerTypes || {})[pt] || ''
                          const opts = [
                            { key:'A', label:`${A} higher` },
                            { key:'Equal', label:'Equal' },
                            { key:'B', label:`${B} higher` },
                            { key:'Neutral', label:'Neutral' }
                          ]
                          return (
                            <div key={`${k}-${pt}`} style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                              <span style={{ minWidth:180 }}><strong>{pt}</strong></span>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                                {opts.map(o => (
                                  <label key={`${k}-${pt}-${o.key}`} className="radio">
                                    <input
                                      type="radio"
                                      name={`powtype-${k}-${pt}`}
                                      value={o.key}
                                      checked={val === o.key}
                                      onChange={(e) =>
                                        setEdge(k, {
                                          powerTypes:{ ...((state.edges[k]?.powerTypes)||{}), [pt]: e.target.value }
                                        })
                                      }
                                    />
                                    {o.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Intentions alignment block (symmetric) */}
      {unorderedPairs.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h4><strong>Intentions alignment (symmetric)</strong></h4>
          <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(360px, 1fr))' }}>
            {unorderedPairs.map(({ A, B, pk }) => {
              const val = state.intents[pk] || ''
              const updateIntent = (value) =>
                setState(s => ({ ...s, intents:{ ...s.intents, [pk]: value } }))
              return (
                <div key={pk} className="card" style={{ padding:12 }}>
                  <strong>{A} ↔ {B}</strong>
                  <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' }}>
                    {['Aligned','Complementary','Conflicting','NA'].map(level => (
                      <label key={`${pk}-${level}`} className="radio">
                        <input
                          type="radio"
                          name={`intent-${pk}`}
                          value={level}
                          checked={val === level}
                          onChange={(e)=>updateIntent(e.target.value)}
                        />
                        {level}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
