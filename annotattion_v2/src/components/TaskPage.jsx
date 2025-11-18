import { useEffect, useMemo, useState } from 'react'
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
  if (Array.isArray(raw?.dialogues)) {
    return { id: raw.id ?? i, dialogue: toTurnsFromStrings(raw.dialogues), summary: raw.memory ?? raw.summary ?? '' }
  }
  if (Array.isArray(raw?.dialogue)) {
    const turns = typeof raw.dialogue[0] === 'string' ? toTurnsFromStrings(raw.dialogue) : (raw.dialogue ?? [])
    return { id: raw.id ?? i, dialogue: turns, summary: raw.summary ?? raw.summ ?? raw.overview ?? '' }
  }
  return { id: raw?.id ?? i, dialogue: Array.isArray(raw?.dialogue) ? raw.dialogue : [], summary: raw?.summary ?? '' }
}
function formatEmotions(emotions = []) {
  if (!Array.isArray(emotions) || emotions.length === 0) return '—'
  const pretty = emotions.map(s => {
    const [p, sec] = s.split('|')
    return sec ? `${p}–${sec}` : p
  })
  return pretty.join(', ')
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
    if (!window.confirm('Delete this profile? This cannot be undone.')) return
    setProfiles(prev => prev.filter(p => p.id !== id))
    const fresh = deleteProfile(id)
    setProfiles(fresh)
  }

  const relatedProfiles = useMemo(
    () => profiles.filter(p => p.lang === lang && p.taskId === taskId),
    [profiles, lang, taskId]
  )
  const speakers = useMemo(() => uniqueSpeakers(task?.dialogue || []), [task])

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
      remarks
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const fname = `annotation_${lang}_task-${taskId}.json`
    const a = document.createElement('a')
    a.href = url
    a.download = fname
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (!task) {
    return (
      <section className="card">
        <h2>No task at index {i}</h2>
        <button className="btn" onClick={() => navigate('/')}>Back to languages</button>
      </section>
    )
  }

  return (
    <section
      className="grid"
      style={{ display:'grid', gap:12, gridTemplateColumns:'1fr 1fr' }}
    >
      <div className="card">
        <h2>Dialogue</h2>
        <Dialogue turns={task.dialogue} />
      </div>

      <div className="card">
        <h2>Summary</h2>
        <Summary text={task.summary} />
      </div>

      <div style={{ gridColumn:'1 / -1' }}>
        <div className="card">
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
            <h3 style={{margin:0}}>Profiles for this task</h3>
            <button className="btn" onClick={openAddForm}>Add profile</button>
          </div>

          {relatedProfiles.length === 0 ? (
            <p style={{marginTop:12}}>No profiles yet.</p>
          ) : (
            <ul className="profiles" style={{marginTop:12}}>
              {relatedProfiles.map((p) => (
                <li key={p.id}>
                  <strong>{p.name || 'Unnamed'}</strong>
                  <div className="muted">{p.gender} · {p.ageGroup} · {p.ethnicity}</div>
                  <div className="muted">{p.socioEconomicClass || '—'} / {p.socialClass || '—'} · {p.country || '—'}</div>
                  <div className="muted">{formatEmotions(p.emotions)}</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button className="btn ghost" onClick={() => openEditForm(p)}>Edit</button>
                    <button className="btn ghost" onClick={() => onDeleteProfile(p.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ gridColumn:'1 / -1' }}>
        <SpeakersDynamics lang={lang} taskId={taskId} turns={task.dialogue} />
      </div>

      <div style={{ gridColumn:'1 / -1' }}>
        <DialogContext lang={lang} taskId={taskId} />
      </div>

      <div style={{ gridColumn:'1 / -1' }}>
        <AnnotatorPerspective lang={lang} taskId={taskId} turns={task.dialogue} />
      </div>

      {/* 🆕 Remarks Box */}
      <div style={{ gridColumn:'1 / -1' }}>
        <RemarksBox lang={lang} taskId={taskId} />
      </div>

      {/* Footer */}
      <div style={{ gridColumn:'1 / -1' }}>
        <div className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn ghost" onClick={prev} disabled={i === 0}>Previous</button>
          </div>
          <div>
            <button className="btn ghost" onClick={onExport}>Export JSON</button>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn" onClick={next} disabled={i >= tasks.length - 1}>Next</button>
          </div>
        </div>
      </div>

      {showForm && (
        <ProfileForm
          onClose={() => { setShowForm(false); setEditingId(null); setFormDefault(undefined) }}
          onSave={onSaveProfile}
          defaultValue={formDefault}
          speakers={speakers}
          {...(editingId == null ? { draftLang: lang, draftTaskId: taskId } : {})}
        />
      )}
    </section>
  )
}
