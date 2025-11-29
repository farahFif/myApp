import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Dialogue from './Dialogue.jsx'
import Summary from './Summary.jsx'
import ProfileForm from './ProfileForm.jsx'
import SpeakersDynamics from './SpeakersDynamics.jsx'
import DialogContext from './DialogContext.jsx'
import AnnotatorPerspective from './AnnotatorPerspective.jsx'
import RemarksBox from './RemarksBox.jsx'
import {
  loadProfiles,
  saveProfile,
  updateProfile,
  deleteProfile,
  loadDraft,
  loadDynamics,
  loadDialogContext,
  loadPerspective,
  loadRemarks,
} from '../utils/storage.js'

function toTurnsFromStrings(lines = []) {
  return lines.map((line) => {
    if (typeof line !== 'string') return { speaker: 'Speaker', text: String(line ?? '') }
    const idx = line.indexOf(':')
    if (idx > -1) {
      const speaker = line.slice(0, idx).trim()
      const text = line.slice(idx + 1).trim()
      return { speaker: speaker || 'Speaker', text }
    }
    return { speaker: 'Speaker', text: line.trim() }
  })
}
function normalizeTask(raw, i) {
  if (raw?.data) {
    const d = raw.data
    const dialogue =
      Array.isArray(d.dialogues)
        ? toTurnsFromStrings(d.dialogues)
        : Array.isArray(d.dialogue)
          ? (typeof d.dialogue[0] === 'string' ? toTurnsFromStrings(d.dialogue) : d.dialogue)
          : []
    const summary = d.memory ?? d.summary ?? d.summ ?? d.overview ?? ''
    return { id: raw.id ?? d.id ?? i, dialogue, summary }
  }
  return { id: raw?.id ?? i, dialogue: [], summary: raw?.summary ?? '' }
}
function uniqueSpeakers(turns = []) {
  const set = new Set()
  for (const t of turns) {
    const name = (t?.speaker || '').trim()
    if (name && name !== 'Speaker') set.add(name)
  }
  return Array.from(set)
}

export default function TaskPage() {
  const { lang, index } = useParams()
  const navigate = useNavigate()

  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState(() => loadProfiles())
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formDefault, setFormDefault] = useState(undefined)

  // Validation + UI error highlight
  const [valid, setValid] = useState({ all:false, profiles:false, dynamics:false, context:false, perspective:false })
  const [showErrors, setShowErrors] = useState(false)
  const profilesRef = useRef(null)
  const dynamicsRef = useRef(null)
  const contextRef = useRef(null)
  const perspectiveRef = useRef(null)

  const base = import.meta.env.BASE_URL || '/'

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${base}data/task_${lang}.json`, { cache: 'no-cache' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.tasks) ? data.tasks : [])
        const normalized = arr.map((t, i) => normalizeTask(t, i))
        if (!cancelled) setTasks(normalized)
      } catch (e) {
        console.error(`task_${lang}.json fetch failed:`, e)
        if (!cancelled) setTasks([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [lang, base])

  const i = Number.isFinite(Number(index)) ? Number(index) : 0
  const task = tasks[i]
  const taskId = task?.id ?? i

  const next = () => navigate(`/task/${encodeURIComponent(lang)}/${Math.min(i + 1, Math.max(tasks.length - 1, 0))}`)
  const prev = () => navigate(`/task/${encodeURIComponent(lang)}/${Math.max(i - 1, 0)}`)

  // Profiles CRUD
  const openAddForm = () => {
    setEditingId(null)
    setFormDefault(loadDraft(lang, taskId) || undefined)
    setShowForm(true)
  }
  const openEditForm = (profile) => {
    setEditingId(profile.id)
    setFormDefault(profile)
    setShowForm(true)
  }
  const onSaveProfile = (form) => {
    const payload = editingId ? { ...form, id: editingId } : { ...form, lang, taskId, savedAt: new Date().toISOString() }
    const updated = editingId ? updateProfile(editingId, payload) : saveProfile(payload)
    setProfiles(updated)
    setShowForm(false)
    setEditingId(null)
    setFormDefault(undefined)
  }
  const onDeleteProfile = (id) => {
    if (!id) return
    if (!window.confirm('Delete this profile?')) return
    setProfiles(prev => prev.filter(p => p.id !== id))
    const fresh = deleteProfile(id)
    setProfiles(fresh)
  }

  const relatedProfiles = useMemo(
    () => profiles.filter(p => p.lang === lang && p.taskId === taskId),
    [profiles, lang, taskId]
  )

  // SPEAKERS from profiles (not dialogue)
  const speakersFromProfiles = useMemo(() => {
    const set = new Set()
    for (const p of relatedProfiles) {
      const name = (p.name || '').trim()
      if (name) set.add(name)
    }
    return Array.from(set)
  }, [relatedProfiles])

  // Validation
  useEffect(() => {
    const result = { profiles: false, dynamics: false, context: false, perspective: false, all: false }

    // Profiles
    if (relatedProfiles.length > 0) {
      let good = true
      for (const p of relatedProfiles) {
        const req = ['name','ageGroup','gender','ethnicity','maritalStatus','education','religion','occupationTier','occupationDetail','socioEconomicClass','socialClass','country']
        for (const f of req) {
          if (!p[f] || String(p[f]).trim() === '') { good = false; break }
        }
        if (!good) break
      }
      result.profiles = good
    }

    // Dynamics
    const dynamics = loadDynamics(lang, taskId)
    if (dynamics && dynamics.edges && Object.keys(dynamics.edges).length > 0) {
      let ok = true
      for (const e of Object.values(dynamics.edges)) {
        for (const f of ['category','relation','familiarity']) {
          if (!e[f]) { ok = false; break }
        }
        if (!ok) break
      }
      result.dynamics = ok
    }

    // Dialog Context
    const ctx = loadDialogContext(lang, taskId)
    if (ctx) {
      const ok =
        !!ctx.formality &&
        (
          (ctx.socialSetting && ctx.socialSetting.trim() !== '') ||
          (Array.isArray(ctx.locationDomain) && ctx.locationDomain.length > 0) ||
          (Array.isArray(ctx.locationPrivacy) && ctx.locationPrivacy.length > 0)
        )
      result.context = !!ok
    }

    // Annotator Perspective
    const ap = loadPerspective(lang, taskId)
    if (ap && ap.pairs && Object.keys(ap.pairs).length > 0) {
      let ok = true
      for (const v of Object.values(ap.pairs)) {
        if (!v.powerDiff || !v.socialDiff || !v.intentAlign) { ok = false; break }
      }
      result.perspective = ok
    }

    result.all = result.profiles && result.dynamics && result.context && result.perspective
    setValid(result)
  }, [relatedProfiles, lang, taskId])

  const handleNext = () => {
    if (valid.all && i < (tasks.length - 1)) {
      next()
      return
    }
    // show errors + scroll to first invalid section
    setShowErrors(true)
    const order = [
      { ok: valid.profiles, ref: profilesRef },
      { ok: valid.dynamics, ref: dynamicsRef },
      { ok: valid.context, ref: contextRef },
      { ok: valid.perspective, ref: perspectiveRef },
    ]
    const firstBad = order.find(s => !s.ok)?.ref
    if (firstBad?.current) {
      firstBad.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Export
  const onExport = () => {
    const dynamics = loadDynamics(lang, taskId) || {}
    const dialogContext = loadDialogContext(lang, taskId) || {}
    const perspective = loadPerspective(lang, taskId) || {}
    const remarks = loadRemarks(lang, taskId) || ''
    const payload = {
      meta: { lang, taskIndex: i, taskId, exportedAt: new Date().toISOString() },
      task: { dialogue: task?.dialogue ?? [], summary: task?.summary ?? '' },
      profiles: relatedProfiles,
      speakersDynamics: dynamics,
      dialogContext,
      annotatorPerspective: perspective,
      remarks,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `annotation_${lang}_task-${taskId}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (!task) {
    return <section className="card"><h2>No task at index {i}</h2></section>
  }

  const errorCardStyle = (flag) => (showErrors && !flag ? { border: '2px solid #d9534f' } : {})

  return (
    <section className="grid" style={{ display:'grid', gap:12, gridTemplateColumns:'1fr 1fr' }}>
      {/* Banner for missing fields */}
      {showErrors && !valid.all && (
        <div style={{ gridColumn:'1 / -1' }}>
          <div className="card" style={{ border: '2px solid #d9534f', background: '#fff5f5' }}>
            <strong>Some required fields are missing.</strong> Please complete the highlighted sections below.
          </div>
        </div>
      )}

      <div className="card"><h2>Dialogue</h2><Dialogue turns={task.dialogue} /></div>
      <div className="card"><h2>Summary</h2><Summary text={task.summary} /></div>

      {/* Profiles */}
      <div style={{ gridColumn:'1 / -1' }}>
        <div ref={profilesRef} className="card" style={errorCardStyle(valid.profiles)}>
          <div style={{display:'flex', justifyContent:'space-between'}}>
            <h3>Profiles for this task</h3>
            <button className="btn" onClick={openAddForm}>Add profile</button>
          </div>
          {relatedProfiles.length === 0 ? <p>No profiles yet.</p> : (
            <ul className="profiles">
              {relatedProfiles.map(p => (
                <li key={p.id}>
                  <strong>{p.name}</strong>
                  <div className="muted">{p.gender} · {p.ageGroup} · {p.ethnicity}</div>
                  <div className="muted">{p.country} · {p.socialClass}/{p.socioEconomicClass}</div>
                  <div style={{ marginTop:8 }}>
                    <button className="btn ghost" onClick={() => openEditForm(p)}>Edit</button>
                    <button className="btn ghost" onClick={() => onDeleteProfile(p.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Speakers Dynamics — uses speakers from profiles */}
      <div style={{ gridColumn:'1 / -1' }}>
        <div ref={dynamicsRef} style={errorCardStyle(valid.dynamics)}>
          <SpeakersDynamics lang={lang} taskId={taskId} speakers={speakersFromProfiles} />
        </div>
      </div>

      {/* Dialog Context */}
      <div style={{ gridColumn:'1 / -1' }}>
        <div ref={contextRef} style={errorCardStyle(valid.context)}>
          <DialogContext lang={lang} taskId={taskId} />
        </div>
      </div>

      {/* Annotator Perspective (unchanged source of speakers; you can switch it to profiles if you prefer) */}
      <div style={{ gridColumn:'1 / -1' }}>
        <div ref={perspectiveRef} style={errorCardStyle(valid.perspective)}>
          <AnnotatorPerspective lang={lang} taskId={taskId} turns={task.dialogue} />
        </div>
      </div>

      {/* Remarks */}
      <div style={{ gridColumn:'1 / -1' }}><RemarksBox lang={lang} taskId={taskId} /></div>

      {/* Footer */}
      <div style={{ gridColumn:'1 / -1' }}>
        <div className="card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button className="btn ghost" onClick={prev} disabled={i === 0}>Previous</button>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn ghost" onClick={onExport}>Export JSON</button>
            <button
              className="btn"
              onClick={handleNext}
              disabled={i >= tasks.length - 1 && valid.all} // last task stays enabled/disabled logically
              style={!valid.all ? { opacity: 0.65 } : {}}
              title={!valid.all ? 'Please complete all required fields before continuing' : 'Next'}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <ProfileForm
          onClose={() => { setShowForm(false); setEditingId(null); setFormDefault(undefined) }}
          onSave={onSaveProfile}
          defaultValue={formDefault}
          speakers={Array.from(new Set(task?.dialogue?.map(t=>t.speaker).filter(Boolean)))}
          {...(editingId == null ? { draftLang: lang, draftTaskId: taskId } : {})}
        />
      )}
    </section>
  )
}
