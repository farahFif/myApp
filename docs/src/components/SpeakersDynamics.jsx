import { useEffect, useMemo, useState } from 'react'
import { loadDynamics, saveDynamics, clearDynamics } from '../utils/storage.js'

const CATEGORIES = {
  Family: [
    'parent of', 'child of','Spouse of',
    'sibling of', 'fiancé of', 'distant family member of',
    'grandparent of', 'grandchild of',
    'uncle of', 'aunt of', 'nephew/niece of',
    'cousin of', 'Other',
  ],
  Social: [
    'neighbour of', 'friend of', 'lover of', 'ex-lover of', 'enemy of',
    'idol of', 'member of same club as', 'Other',
  ],
  Professional: [
    'boss of', 'employee of', 'employer of',
    'teacher of', 'student of',
    'doctor of', 'patient of',
    'seller to', 'client of',
    'colleague of', 'classmate of',
    'religious relationship with', 'Other',
  ],
  Other: ['Other'],
}

const FAMILIARITY = [
  'Stranger', 'Acquaintance', 'Minimal familiarity',
  'Somewhat familiar', 'Moderate familiarity', 'Intimate/very high'
]

const POWER_TYPES = [
  'Coercive', 'Reward-based', 'Legitimate/Legal', 'Expert',
  'Referent/Charismatic', 'Informational', 'Ideological', 'NA'
]

const POWER_DIFF = ['High power', 'Equal power', 'Less power', 'Neutral']
const SOCIAL_DIFF = ['Higher status', 'Equal status', 'Lower status', 'Neutral']
const ACCOM_LEVELS = ['Divergent', 'Neutral', 'Convergent']

const POWER_TYPE_DEFINITIONS = {
  English: {
    'Coercive': 'Coercive power relies on the ability to punish or enforce consequences for disobedience. E.g: a manager threatening to fire an employee',
    'Reward-based': 'Reward power comes from the ability toprovide positive incentives or benefits. E.g: a manger offering bonus',
    'Legitimate/Legal': 'Legitimate power is based on a person’s formal position or authority. E.g: a police officer enforcing the law, a mother making rules for her children',
    'Expert': 'Expert power comes from possessing specialized knowledge, skills, or experience that others respect. E.g: a doctor, a teacher explaining a concept',
    'Referent/Charismatic': 'is based on personal qualities that make others admire or trust. E.g: a charismatic, a celebrity, a charismatic person',
    'Informational': 'Informational power arises from controlling access to important data or insights. E.g: a journalist with exclusive information, a person with insider knowledge',
    'Ideological': 'Ideological power is rooted in shared beliefs or values that inspire others to act. E.g: a political leader rallying supporters, a religious leader guiding followers',
    'NA': 'hard to dermine or the dialogue does not exhibit any type of power for a speaker.',
  },
  Arabic: {
  'Coercive': 'القوة القسرية تعتمد على القدرة على معاقبة الآخرين أو فرض عواقب عند عدم الطاعة. مثال: مدير يهدد بفصل موظف.',
  'Reward-based': 'قوة المكافأة تنبع من القدرة على تقديم حوافز أو مزايا إيجابية. مثال: مدير يعرض مكافأة مالية.',
  'Legitimate/Legal': 'القوة الشرعية/القانونية تستند إلى المنصب الرسمي أو السلطة المعترف بها للشخص. مثال: شرطي يطبق القانون، أم تضع قواعد لأطفالها.',
  'Expert': 'قوة الخبرة تأتي من امتلاك معرفة أو مهارات أو خبرة متخصصة يحترمها الآخرون. مثال: طبيب، معلم يشرح مفهوماً.',
  'Referent/Charismatic': 'القوة المرجعية/الكاريزمية تعتمد على الصفات الشخصية التي تجعل الآخرين يعجبون بالشخص أو يثقون به. مثال: شخصية كاريزمية، مشهور مؤثر.',
  'Informational': 'القوة المعلوماتية تنشأ من التحكم في الوصول إلى معلومات أو بيانات مهمة. مثال: صحفي يمتلك معلومات حصرية، شخص لديه معرفة داخلية.',
  'Ideological': 'القوة الأيديولوجية ترتكز على معتقدات أو قيم مشتركة تلهم الآخرين للتصرف. مثال: قائد سياسي يحشد أنصاره، قائد ديني يوجه أتباعه.',
  'NA': 'يصعب التحديد أو أن الحوار لا يُظهر أي نوع من أنواع القوة من جانب المتحدث.'
},

}

function edgeKey(a, b) {
  return `${a}→${b}`
}

function parseDirectedEdgeKey(k) {
  if (typeof k !== 'string' || !k.includes('→')) return ['', '']
  const idx = k.indexOf('→')
  return [k.slice(0, idx), k.slice(idx + 1)]
}

function pairKey(a, b) {
  const [A, B] = [a, b].map(String).sort((x, y) => x.localeCompare(y))
  return `${A} | ${B}`
}

function isLegacySymmetricKey(k) {
  return k.includes('|') && !k.includes('→')
}

function normalizePowerTypeValue(value) {
  if (value === 'A') return 'Higher'
  if (value === 'B') return 'Lower'
  if (value === 'Neutral') return 'Neutral'
  if (value === 'Higher' || value === 'Equal' || value === 'Lower' || value === 'Neutral') return value
  return ''
}

function normalizeEdgePayload(edge = {}) {
  const powerTypes = edge?.powerTypes || {}
  const normalizedPowerTypes = {}
  for (const [pt, v] of Object.entries(powerTypes)) {
    const nv = normalizePowerTypeValue(v)
    if (nv) normalizedPowerTypes[pt] = nv
  }
  return {
    ...edge,
    powerTypes: normalizedPowerTypes,
  }
}

export default function SpeakersDynamics({ lang, taskId, speakers = [], uiLang }) {
  const [activePowerTip, setActivePowerTip] = useState('')
  const [state, setState] = useState(() => ({
    speakers,
    edges: {},   // directed A→B data
    powers: {},  // per-speaker selected power types
    intents: {}, // symmetric intentions alignment
  }))

  const isArabicUi = String(uiLang || '').toLowerCase() === 'arabic'
  const defsByUiLang = isArabicUi ? POWER_TYPE_DEFINITIONS.Arabic : POWER_TYPE_DEFINITIONS.English
  const missingDefText = isArabicUi ? 'لم يتم إضافة تعريف بعد' : 'Definition not added yet'
  const getPowerDefinitionBullets = (powerType) => {
    const raw = defsByUiLang?.[powerType] || missingDefText
    return String(raw)
      .replace(/\r/g, '')
      .split(/(?<=[.!?۔])\s+|\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

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
            sourceSpeaker: A,
            targetSpeaker: B,
            category: v.category || '',
            relation: v.relation || '',
            familiarity: v.familiarity || '',
          }
          migratedEdges[edgeKey(A, B)] = normalizeEdgePayload({ ...payload })
          migratedEdges[edgeKey(B, A)] = normalizeEdgePayload({
            ...payload,
            sourceSpeaker: B,
            targetSpeaker: A,
          })
        } else {
          const [A, B] = parseDirectedEdgeKey(k)
          migratedEdges[k] = normalizeEdgePayload({
            ...v,
            sourceSpeaker: v?.sourceSpeaker || A,
            targetSpeaker: v?.targetSpeaker || B,
          })
        }
      }

      const powers = saved.powers || {}
      setState({ speakers, edges: migratedEdges, powers, intents })
      saveDynamics(lang, taskId, { speakers, edges: migratedEdges, powers, intents })
    } else {
      setState({ speakers, edges: {}, powers: {}, intents: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, taskId])

  // Keep state.speakers synced with prop speakers
  useEffect(() => {
    setState((s) => {
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
  useEffect(() => {
    saveDynamics(lang, taskId, state)
  }, [state, lang, taskId])

  const directedPairs = useMemo(() => {
    const s = state.speakers.map((v) => v.trim()).filter(Boolean)
    const out = []
    for (let i = 0; i < s.length; i++) {
      for (let j = 0; j < s.length; j++) {
        if (i === j) continue
        const A = s[i]
        const B = s[j]
        out.push({ A, B, k: edgeKey(A, B) })
      }
    }
    return out
  }, [state.speakers])

  const unorderedPairs = useMemo(() => {
    const s = state.speakers.map((v) => v.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
    const out = []
    for (let i = 0; i < s.length; i++) {
      for (let j = i + 1; j < s.length; j++) {
        const A = s[i]
        const B = s[j]
        const pk = pairKey(A, B)
        out.push({ A, B, pk })
      }
    }
    return out
  }, [state.speakers])

  const setEdge = (k, patch) => {
    const [A, B] = parseDirectedEdgeKey(k)
    setState((s) => ({
      ...s,
      edges: {
        ...s.edges,
        [k]: {
          sourceSpeaker: A,
          targetSpeaker: B,
          ...(s.edges[k] || {}),
          ...patch,
        },
      },
    }))
  }

  const ensurePowerObj = (speaker) => {
    if (!state.powers[speaker]) {
      setState((s) => ({
        ...s,
        powers: { ...s.powers, [speaker]: { selected: [] } },
      }))
      return { selected: [] }
    }
    return state.powers[speaker]
  }

  const toggleSpeakerPower = (speaker, power, checked) => {
    const cur = ensurePowerObj(speaker)
    const selected = new Set(cur.selected || [])
    if (checked) selected.add(power)
    else selected.delete(power)
    setState((s) => ({
      ...s,
      powers: {
        ...s.powers,
        [speaker]: { selected: Array.from(selected) },
      },
    }))
  }

  const sourcePowers = (A) => state.powers[A]?.selected || []

  const resetAll = () => {
    clearDynamics(lang, taskId)
    setState({ speakers, edges: {}, powers: {}, intents: {} })
  }

  const renderDirectedPair = (A, B) => (
    <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>
      <bdi>{A}</bdi> {'→'} <bdi>{B}</bdi>
    </span>
  )

  return (
    <div className="card" style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Speakers Dynamics</h3>
        <button className="btn ghost" onClick={resetAll}>Reset</button>
      </div>
      <p className="muted" style={{ margin: '0 12px 4px' }}>
        For each pair of speakers, indicate how they are related, how familiar they are,
        and how power and status are distributed between them.
      </p>

      {/* Speaker Powers */}
      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>
          <strong>Speaker Powers (select types per speaker)</strong>
        </h4>
        <p className="muted">For each speaker determine their type of power(s).</p>
        {state.speakers.length === 0 ? (
          <p className="muted">Create profiles to annotate powers.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            }}
          >
            {state.speakers.map((sp) => {
              const po = state.powers[sp] || { selected: [] }
              const openId = `powers-${sp}`
              return (
                <div key={sp} className="card" style={{ padding: 12 }}>
                  <strong>{sp}</strong>
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer' }}>
                      <strong>Select powers</strong>
                    </summary>
                    <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
                      {POWER_TYPES.map((pt) => {
                        const checked = (po.selected || []).includes(pt)
                        const id = `${openId}-${pt}`
                        const tipKey = `${sp}::${pt}::select`
                        return (
                          <label key={id} className="radio" style={{ marginRight: 8 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleSpeakerPower(sp, pt, e.target.checked)}
                            />{' '}
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {pt}
                              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  aria-label={`${pt} definition`}
                                  onMouseEnter={() => setActivePowerTip(tipKey)}
                                  onMouseLeave={() => setActivePowerTip('')}
                                  onFocus={() => setActivePowerTip(tipKey)}
                                  onBlur={() => setActivePowerTip('')}
                                  onClick={() => setActivePowerTip((prev) => (prev === tipKey ? '' : tipKey))}
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    border: '1px solid #7a7a7a',
                                    color: '#4f4f4f',
                                    fontSize: 11,
                                    lineHeight: '14px',
                                    textAlign: 'center',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'help',
                                    userSelect: 'none',
                                    padding: 0,
                                    background: '#fff',
                                    minWidth: 16,
                                  }}
                                >
                                  ?
                                </button>
                                {activePowerTip === tipKey && (
                                  <span
                                    role="tooltip"
                                    style={{
                                      position: 'absolute',
                                      left: 20,
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      background: '#111',
                                      color: '#fff',
                                      fontSize: 14,
                                      lineHeight: 1.5,
                                      borderRadius: 6,
                                      padding: '10px 12px',
                                      whiteSpace: 'normal',
                                      width: 360,
                                      zIndex: 20,
                                      textAlign: 'left',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                                    }}
                                  >
                                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                                      {getPowerDefinitionBullets(pt).map((item, i) => (
                                        <li key={`${tipKey}-${i}`}>{item}</li>
                                      ))}
                                    </ul>
                                  </span>
                                )}
                              </span>
                            </span>
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
        <div
          style={{
            marginTop: 12,
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          }}
        >
          {directedPairs.map(({ A, B, k }) => {
            const e = state.edges[k] || {}
            const category = e.category || ''
            const relation = e.relation || ''
            const familiarity = e.familiarity || ''

            const powerDiff = e.powerDiff || ''
            const powerDiffPersp = e.powerDiffPersp || ''
            const socialDiff = e.socialDiff || ''
            const socialDiffPersp = e.socialDiffPersp || ''

            const accommodation = e.accommodation || ''
            const intentAlignment = e.intentAlignment || ''

            const powersToCompare = sourcePowers(A)

            return (
              <div key={k} className="card" style={{ borderRadius: 12 }}>
                <strong>
                  {renderDirectedPair(A, B)}
                </strong>
                <p className="muted">Annotate from the perspective of {A}</p>
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <label>
                    <strong>Relationship Category</strong>
                    <select
                      value={category}
                      onChange={(ev) => setEdge(k, { category: ev.target.value, relation: '' })}
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {Object.keys(CATEGORIES).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
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
                        <option value="" disabled>
                          {category ? 'Select…' : 'Choose category first'}
                        </option>
                        {category &&
                          CATEGORIES[category].map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
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
                      <option value="" disabled>
                        Select…
                      </option>
                      {FAMILIARITY.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* 1. Intentions alignment (from A's perspective) */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong>Intentions alignment (from {A}'s perspective)</strong>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        alignItems: 'center',
                        marginTop: 4,
                      }}
                    >
                      {['Aligned', 'Complementary', 'Conflicting', 'NA'].map((level) => (
                        <label key={`${k}-intent-${level}`} className="radio">
                          <input
                            type="radio"
                            name={`intent-dir-${k}`}
                            value={level}
                            checked={intentAlignment === level}
                            onChange={(e2) => setEdge(k, { intentAlignment: e2.target.value })}
                          />
                          {level}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 2. Overall power difference (dialogue-based) */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong>Overall power difference. Does {A} compared to {B} have:</strong>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        alignItems: 'center',
                        marginTop: 4,
                      }}
                    >
                      {POWER_DIFF.map((opt) => (
                        <label key={`${k}-pd-dialogue-${opt}`} className="radio">
                          <input
                            type="radio"
                            name={`powdiff-dialogue-${k}`}
                            value={opt}
                            checked={powerDiff === opt}
                            onChange={(e2) => setEdge(k, { powerDiff: e2.target.value })}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 3. Overall power difference (from your perspective) */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong>
                      Overall power difference (from your perspective). Does {A} compared to {B} have:
                    </strong>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        alignItems: 'center',
                        marginTop: 4,
                      }}
                    >
                      {POWER_DIFF.map((opt) => (
                        <label key={`${k}-pd-persp-${opt}`} className="radio">
                          <input
                            type="radio"
                            name={`powdiff-persp-${k}`}
                            value={opt}
                            checked={powerDiffPersp === opt}
                            onChange={(e2) => setEdge(k, { powerDiffPersp: e2.target.value })}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 4. Overall social status difference (dialogue-based) */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong>Overall social status difference. Does {A} compared to {B} have:</strong>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        alignItems: 'center',
                        marginTop: 4,
                      }}
                    >
                      {SOCIAL_DIFF.map((opt) => (
                        <label key={`${k}-sd-dialogue-${opt}`} className="radio">
                          <input
                            type="radio"
                            name={`socialdiff-dialogue-${k}`}
                            value={opt}
                            checked={socialDiff === opt}
                            onChange={(e2) => setEdge(k, { socialDiff: e2.target.value })}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 5. Overall social status difference (from your perspective) */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong>
                      Overall social status difference (from your perspective). Does {A} compared to {B} have:
                    </strong>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        alignItems: 'center',
                        marginTop: 4,
                      }}
                    >
                      {SOCIAL_DIFF.map((opt) => (
                        <label key={`${k}-sd-persp-${opt}`} className="radio">
                          <input
                            type="radio"
                            name={`socialdiff-persp-${k}`}
                            value={opt}
                            checked={socialDiffPersp === opt}
                            onChange={(e2) => setEdge(k, { socialDiffPersp: e2.target.value })}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 6. Communication accommodation (A → B) */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong>Communication accommodation ({renderDirectedPair(A, B)})</strong>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        alignItems: 'center',
                      }}
                    >
                      {ACCOM_LEVELS.map((level) => (
                        <label key={`${k}-accom-${level}`} className="radio">
                          <input
                            type="radio"
                            name={`accom-${k}`}
                            value={level}
                            checked={accommodation === level}
                            onChange={(e2) => setEdge(k, { accommodation: e2.target.value })}
                          />
                          {level}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Power by type comparisons (unchanged) */}
                  {powersToCompare.length > 0 && (
                    <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
                      <strong>Power comparisons by type ({A} vs {B})</strong>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {powersToCompare.map((pt) => {
                          const val = normalizePowerTypeValue((state.edges[k]?.powerTypes || {})[pt])
                          const tipKey = `${k}::${pt}::compare`
                          const opts = [
                            { key: 'Higher', label: 'Higher' },
                            { key: 'Equal', label: 'Equal' },
                            { key: 'Lower', label: 'Lower' },
                            { key: 'Neutral', label: 'Neutral' },
                          ]
                          return (
                            <div
                              key={`${k}-${pt}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                flexWrap: 'wrap',
                              }}
                            >
                              <span style={{ minWidth: 180 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  <strong>{pt}</strong>
                                  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      aria-label={`${pt} definition`}
                                      onMouseEnter={() => setActivePowerTip(tipKey)}
                                      onMouseLeave={() => setActivePowerTip('')}
                                      onFocus={() => setActivePowerTip(tipKey)}
                                      onBlur={() => setActivePowerTip('')}
                                      onClick={() => setActivePowerTip((prev) => (prev === tipKey ? '' : tipKey))}
                                      style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        border: '1px solid #7a7a7a',
                                        color: '#4f4f4f',
                                        fontSize: 11,
                                        lineHeight: '14px',
                                        textAlign: 'center',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'help',
                                        userSelect: 'none',
                                        padding: 0,
                                        background: '#fff',
                                        minWidth: 16,
                                      }}
                                    >
                                      ?
                                    </button>
                                    {activePowerTip === tipKey && (
                                      <span
                                        role="tooltip"
                                        style={{
                                          position: 'absolute',
                                          left: 20,
                                          top: '50%',
                                          transform: 'translateY(-50%)',
                                          background: '#111',
                                          color: '#fff',
                                          fontSize: 14,
                                          lineHeight: 1.5,
                                          borderRadius: 6,
                                          padding: '10px 12px',
                                          whiteSpace: 'normal',
                                          width: 360,
                                          zIndex: 20,
                                          textAlign: 'left',
                                          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                                        }}
                                      >
                                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                                          {getPowerDefinitionBullets(pt).map((item, i) => (
                                            <li key={`${tipKey}-${i}`}>{item}</li>
                                          ))}
                                        </ul>
                                      </span>
                                    )}
                                  </span>
                                </span>
                              </span>
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 10,
                                }}
                              >
                                {opts.map((o) => (
                                  <label
                                    key={`${k}-${pt}-${o.key}`}
                                    className="radio"
                                  >
                                    <input
                                      type="radio"
                                      name={`powtype-${k}-${pt}`}
                                      value={o.key}
                                      checked={val === o.key}
                                      onChange={(e2) =>
                                        setEdge(k, {
                                          powerTypes: {
                                            ...((state.edges[k]?.powerTypes) || {}),
                                            [pt]: e2.target.value,
                                          },
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
          <h4>
            <strong>Intentions alignment (Your Perspective)</strong>
          </h4>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            }}
          >
            {unorderedPairs.map(({ A, B, pk }) => {
              const val = state.intents[pk] || ''
              const updateIntent = (value) =>
                setState((s) => ({
                  ...s,
                  intents: {
                    ...s.intents,
                    [pk]: value,
                  },
                }))
              return (
                <div key={pk} className="card" style={{ padding: 12 }}>
                  <strong>
                    {A} ↔ {B}
                  </strong>
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    {['Aligned', 'Complementary', 'Conflicting', 'NA'].map((level) => (
                      <label key={`${pk}-${level}`} className="radio">
                        <input
                          type="radio"
                          name={`intent-${pk}`}
                          value={level}
                          checked={val === level}
                          onChange={(e2) => updateIntent(e2.target.value)}
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
