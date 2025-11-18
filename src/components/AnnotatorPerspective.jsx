import { useEffect, useMemo, useState } from 'react'
import { loadPerspective, savePerspective, clearPerspective } from '../utils/storage.js'

const POWER_DIFF = ['High power','Equal power','Less power','Neutral']
const SOCIAL_DIFF = ['Higher status','Equal status','Lower status','Neutral']
const INTENT_ALIGN = ['Aligned', 'Complementary', 'Conflicting', 'NA']

function pairKey(a, b) {
  const [A, B] = [a, b].map(String).sort((x, y) => x.localeCompare(y))
  return `${A} | ${B}`
}

function uniqueSpeakersFromTurns(turns = []) {
  const set = new Set()
  for (const t of turns) if (t?.speaker && t.speaker !== 'Speaker') set.add(String(t.speaker))
  return Array.from(set)
}

export default function AnnotatorPerspective({ lang, taskId, turns }) {
  const initialSpeakers = uniqueSpeakersFromTurns(turns)

  const [state, setState] = useState(() => ({
    speakers: initialSpeakers,
    pairs: {} // { 'A | B': { powerDiff, socialDiff, intentAlign } }
  }))

  useEffect(() => {
    const saved = loadPerspective(lang, taskId)
    if (saved) {
      setState({
        speakers: initialSpeakers,
        pairs: saved.pairs || {}
      })
    } else {
      setState({ speakers: initialSpeakers, pairs: {} })
    }
  }, [lang, taskId])

  useEffect(() => { savePerspective(lang, taskId, state) }, [state, lang, taskId])

  const unorderedPairs = useMemo(() => {
    const s = state.speakers.map(v => v.trim()).filter(Boolean).sort((a,b)=>a.localeCompare(b))
    return s.flatMap((A,i)=>s.slice(i+1).map(B=>({A,B,pk:pairKey(A,B)})))
  }, [state.speakers])

  const setPair = (pk, patch) => {
    setState(s => ({ ...s, pairs:{ ...s.pairs, [pk]:{ ...(s.pairs[pk]||{}), ...patch } } }))
  }

  const resetAll = () => {
    if (!confirm("Clear annotator's perspective for this task?")) return
    clearPerspective(lang, taskId)
    setState({ speakers: initialSpeakers, pairs: {} })
  }

  return (
    <div className="card" style={{ width:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <h3 style={{ margin: 0 }}>Annotator’s perspective</h3>
        <button className="btn ghost" onClick={resetAll}>Reset</button>
      </div>

      {unorderedPairs.length === 0 ? (
        <p style={{ marginTop: 12 }}>Add at least two speakers to annotate.</p>
      ) : (
        <div
          style={{
            marginTop: 12,
            display:'grid',
            gap:12,
            gridTemplateColumns:'repeat(auto-fit, minmax(420px, 1fr))'
          }}
        >
          {unorderedPairs.map(({ A, B, pk }) => {
            const p = state.pairs[pk] || {}
            return (
              <div key={pk} className="card" style={{ padding: 12 }}>
                <strong>{A} ↔ {B}</strong>

                <div style={{ marginTop: 10 }}>
                  <strong style={{ display:'block', marginBottom: 6 }}>Overall power difference</strong>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' }}>
                    {POWER_DIFF.map(opt => (
                      <label key={`${pk}-pow-${opt}`} className="radio" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                        <input
                          type="radio"
                          name={`ap-pow-${pk}`}
                          value={opt}
                          checked={p.powerDiff === opt}
                          onChange={(e) => setPair(pk, { powerDiff: e.target.value })}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <strong style={{ display:'block', marginBottom: 6 }}>Overall social status difference</strong>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' }}>
                    {SOCIAL_DIFF.map(opt => (
                      <label key={`${pk}-soc-${opt}`} className="radio" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                        <input
                          type="radio"
                          name={`ap-soc-${pk}`}
                          value={opt}
                          checked={p.socialDiff === opt}
                          onChange={(e) => setPair(pk, { socialDiff: e.target.value })}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <strong style={{ display:'block', marginBottom: 6 }}>Intentions alignment</strong>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' }}>
                    {INTENT_ALIGN.map(level => (
                      <label key={`${pk}-intent-${level}`} className="radio" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                        <input
                          type="radio"
                          name={`ap-intent-${pk}`}
                          value={level}
                          checked={p.intentAlign === level}
                          onChange={(e) => setPair(pk, { intentAlign: e.target.value })}
                        />
                        {level}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
