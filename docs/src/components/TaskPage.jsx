import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Dialogue from './Dialogue.jsx'
import Summary from './Summary.jsx'
import ProfileForm from './ProfileForm.jsx'
import SpeakersDynamics from './SpeakersDynamics.jsx'
import DialogContext from './DialogContext.jsx'
// import AnnotatorPerspective from './AnnotatorPerspective.jsx'   // ⬅️ kept for future use
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
  loadTime,
  saveTime,
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
          ? (typeof d.dialogue[0] === 'string'
              ? toTurnsFromStrings(d.dialogue)
              : d.dialogue)
          : []
    const summary = d.memory ?? d.summary ?? d.summ ?? d.overview ?? ''
    return { id: raw.id ?? d.id ?? i, dialogue, summary }
  }
  return { id: raw?.id ?? i, dialogue: [], summary: raw?.summary ?? '' }
}

export default function TaskPage() {
  const { lang, index } = useParams()
  const navigate = useNavigate()

  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState(() => loadProfiles())
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formDefault, setFormDefault] = useState(undefined)

  // Validation state
  const [valid, setValid] = useState({
    all: false,
    profiles: false,
    dynamics: false,
    context: false,
    perspective: true, // Annotator’s Perspective disabled → always true
  })
  const [showErrors, setShowErrors] = useState(false)

  const profilesRef = useRef(null)
  const dynamicsRef = useRef(null)
  const contextRef = useRef(null)
  // const perspectiveRef = useRef(null) // if you re-enable AnnotatorPerspective

  const base = import.meta.env.BASE_URL || '/'

  // Load tasks for this language
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${base}data/task_${lang}.json`, { cache: 'no-cache' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.tasks) ? data.tasks : [])
        const normalized = arr.map((t, idx) => normalizeTask(t, idx))
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

  // Silent time tracking per (lang, taskId)
  useEffect(() => {
    let current = loadTime(lang, taskId) || 0
    let last = Date.now()

    function tick() {
      const now = Date.now()
      if (document.visibilityState === 'visible') {
        current += now - last
        saveTime(lang, taskId, current)
      }
      last = now
    }

    const intervalId = setInterval(tick, 1000)

    function handleVisibilityChange() {
      last = Date.now()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [lang, taskId])

  const next = () =>
    navigate(`/task/${encodeURIComponent(lang)}/${Math.min(i + 1, Math.max(tasks.length - 1, 0))}`)
  const prev = () =>
    navigate(`/task/${encodeURIComponent(lang)}/${Math.max(i - 1, 0)}`)

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
    const payload = editingId
      ? { ...form, id: editingId }
      : { ...form, lang, taskId, savedAt: new Date().toISOString() }
    const updated = editingId ? updateProfile(editingId, payload) : saveProfile(payload)
    setProfiles(updated)
    setShowForm(false)
    setEditingId(null)
    setFormDefault(undefined)
  }

  const onDeleteProfile = (id) => {
    if (!id) return
    if (!window.confirm('Delete this profile?')) return
    const fresh = deleteProfile(id)
    setProfiles(fresh)
  }

  const relatedProfiles = useMemo(
    () => profiles.filter((p) => p.lang === lang && p.taskId === taskId),
    [profiles, lang, taskId],
  )

  // Speakers from profiles
  const speakersFromProfiles = useMemo(() => {
    const set = new Set()
    for (const p of relatedProfiles) {
      const name = (p.name || '').trim()
      if (name) set.add(name)
    }
    return Array.from(set)
  }, [relatedProfiles])

  // ---------------- VALIDATION LOGIC (centralised) ----------------

  function computeValidity() {
    const result = {
      profiles: false,
      dynamics: false,
      context: false,
      perspective: true, // still disabled
      all: false,
    }

    // Profiles (type-safe)
    if (relatedProfiles.length > 0) {
      let good = true
      const requiredFields = [
        'name',
        'ageGroup',
        'gender',
        'ethnicity',
        'maritalStatus',
        'education',
        'religion',
        'occupationTier',
        'occupationDetail',
        'socioEconomicClass',
        'socialClass',
        'country',
      ]

      outer: for (const p of relatedProfiles) {
        for (const field of requiredFields) {
          const value = p[field]
          if (value === null || value === undefined) {
            good = false
            break outer
          }
          if (typeof value === 'string' && value.trim() === '') {
            good = false
            break outer
          }
        }
      }
      result.profiles = good
    } else {
      result.profiles = false
    }

    // Speakers Dynamics – require that any *touched* edge has category+relation+familiarity
    const dynamics = loadDynamics(lang, taskId)
    if (dynamics && dynamics.edges) {
      const edges = Object.values(dynamics.edges)
      const touched = edges.filter(
        (e) => e && (e.category || e.relation || e.familiarity),
      )
      if (touched.length > 0) {
        result.dynamics = touched.every(
          (e) => e.category && e.relation && e.familiarity,
        )
      } else {
        result.dynamics = false
      }
    } else {
      result.dynamics = false
    }

    // Dialog Context
    const ctx = loadDialogContext(lang, taskId)
    if (ctx) {
      const socialSettingFilled =
        typeof ctx.socialSetting === 'string' && ctx.socialSetting.trim() !== ''

      const domainFilled = Array.isArray(ctx.locationDomain)
        ? ctx.locationDomain.length > 0
        : !!ctx.locationDomain

      const privacyFilled = Array.isArray(ctx.locationPrivacy)
        ? ctx.locationPrivacy.length > 0
        : !!ctx.locationPrivacy

      const formalityFilled = !!ctx.formality

      result.context =
        formalityFilled &&
        (socialSettingFilled || domainFilled || privacyFilled)
    } else {
      result.context = false
    }

    // ⬇️ Old Annotator Perspective validation kept for future use
    /*
    const ap = loadPerspective(lang, taskId)
    if (ap && ap.pairs) {
      ...
      result.perspective = ok
    }
    */

    result.all =
      result.profiles &&
      result.dynamics &&
      result.context &&
      result.perspective

    return result
  }

  // Recompute validity when profiles/lang/task change (for initial colour state)
  useEffect(() => {
    const v = computeValidity()
    setValid(v)
  }, [relatedProfiles, lang, taskId])

  const handleNext = () => {
    const v = computeValidity()
    setValid(v)

    if (v.all && i < tasks.length - 1) {
      next()
      return
    }

    // show errors + scroll to first invalid section
    setShowErrors(true)
    const order = [
      { ok: v.profiles, ref: profilesRef },
      { ok: v.dynamics, ref: dynamicsRef },
      { ok: v.context, ref: contextRef },
      // { ok: v.perspective, ref: perspectiveRef },
    ]
    const firstBad = order.find((s) => !s.ok)?.ref
    if (firstBad?.current) {
      firstBad.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Export ALL tasks for this language, including timeSpentMs
  const onExport = () => {
    const allData = []

    tasks.forEach((t, taskIndex) => {
      const thisTaskId = t.id ?? taskIndex

      const dynamics = loadDynamics(lang, thisTaskId) || {}
      const dialogContext = loadDialogContext(lang, thisTaskId) || {}
      const perspective = loadPerspective(lang, thisTaskId) || {}
      const remarks = loadRemarks(lang, thisTaskId) || ''

      const taskProfiles = profiles.filter(
        (p) => p.lang === lang && p.taskId === thisTaskId,
      )

      const timeSpentMs = loadTime(lang, thisTaskId) || 0

      allData.push({
        meta: {
          lang,
          taskIndex,
          taskId: thisTaskId,
          exportedAt: new Date().toISOString(),
          timeSpentMs,
        },
        task: {
          dialogue: t.dialogue ?? [],
          summary: t.summary ?? '',
        },
        profiles: taskProfiles,
        speakersDynamics: dynamics,
        dialogContext,
        annotatorPerspective: perspective,
        remarks,
      })
    })

    const exportPayload = {
      language: lang,
      totalTasks: allData.length,
      exportedAt: new Date().toISOString(),
      annotations: allData,
    }

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    })

    const url = URL.createObjectURL(blob)
    const fname = `all_annotations_${lang}.json`

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
      </section>
    )
  }

  const errorCardStyle = (flag) =>
    showErrors && !flag ? { border: '2px solid #d9534f' } : {}

  return (
    <section
      className="grid"
      style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}
    >
      {/* Banner for missing fields */}
      {showErrors && !valid.all && (
        <div style={{ gridColumn: '1 / -1' }}>
          <div
            className="card"
            style={{ border: '2px solid #d9534f', background: '#fff5f5' }}
          >
            <strong>Some required fields are missing.</strong> Please complete
            the highlighted sections below.
          </div>
        </div>
      )}

      {/* Top row: Dialogue | Summary */}
      <div className="card">
        <h2>Dialogue</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Read the conversation carefully. Use it as the basis for all your annotations.
        </p>
        <Dialogue turns={task.dialogue} />
      </div>
      <div className="card">
        <h2>Summary</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          This summary captures the overall situation. Use it to double-check your understanding.
        </p>
        <Summary text={task.summary} />
      </div>

      {/* Profiles */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div
          ref={profilesRef}
          className="card"
          style={errorCardStyle(valid.profiles)}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <h3>Profiles for this task</h3>
            <button className="btn" onClick={openAddForm}>
              Add profile
            </button>
          </div>
          <p className="muted" style={{ marginTop: 4 }}>
            Define each speaker&apos;s demographic and social profile. These profiles are
            later used in Speakers Dynamics.
          </p>
          {relatedProfiles.length === 0 ? (
            <p>No profiles yet.</p>
          ) : (
            <ul className="profiles">
              {relatedProfiles.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}</strong>
                  <div className="muted">
                    {p.gender} · {p.ageGroup} · {p.ethnicity}
                  </div>
                  <div className="muted">
                    {p.country} · {p.socialClass}/{p.socioEconomicClass}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button
                      className="btn ghost"
                      onClick={() => openEditForm(p)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => onDeleteProfile(p.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Speakers Dynamics */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div ref={dynamicsRef} style={errorCardStyle(valid.dynamics)}>
          <SpeakersDynamics
            lang={lang}
            taskId={taskId}
            speakers={speakersFromProfiles}
          />
        </div>
      </div>

      {/* Dialog Context */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div ref={contextRef} style={errorCardStyle(valid.context)}>
          <DialogContext lang={lang} taskId={taskId} />
        </div>
      </div>

      {/* Annotator Perspective — DISABLED, kept commented for later */}
      {/*
      <div style={{ gridColumn: '1 / -1' }}>
        <div ref={perspectiveRef} style={errorCardStyle(valid.perspective)}>
          <h3>Annotator’s Perspective</h3>
          <p className="muted" style={{ margin: '0 12px 4px' }}>
            Based on your own interpretation, indicate perceived power, status
            differences and intentions alignment between speakers from your perspective.
          </p>
          <AnnotatorPerspective
            lang={lang}
            taskId={taskId}
            turns={task.dialogue}
          />
        </div>
      </div>
      */}

      {/* Remarks */}
      <div style={{ gridColumn: '1 / -1' }}>
        <RemarksBox lang={lang} taskId={taskId} />
      </div>

      {/* Footer */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div
          className="card"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button className="btn ghost" onClick={prev} disabled={i === 0}>
            Previous
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={onExport}>
              Export JSON
            </button>
            <button
              className="btn"
              onClick={handleNext}
              disabled={i >= tasks.length - 1 && valid.all}
              style={!valid.all ? { opacity: 0.65 } : {}}
              title={
                !valid.all
                  ? 'Please complete all required fields before continuing'
                  : 'Next'
              }
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Popup Profile Form with Dialogue */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '1100px',
              height: '90vh',
              display: 'grid',
              gridTemplateColumns: '1.1fr 0.9fr',
              gap: 16,
              overflow: 'hidden',
            }}
          >
            {/* Left: Dialogue */}
            <div
              style={{
                borderRight: '1px solid #ddd',
                paddingRight: 12,
                overflowY: 'auto',
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <h3 style={{ margin: 0 }}>Dialogue</h3>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    setFormDefault(undefined)
                  }}
                >
                  Close
                </button>
              </div>
              <Dialogue turns={task.dialogue} />
            </div>

            {/* Right: Profile form */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                paddingLeft: 12,
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                {editingId ? 'Edit profile' : 'New profile'}
              </h3>
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                }}
              >
                <ProfileForm
                  onClose={() => {
                    setShowForm(false)
                    setEditingId(null)
                    setFormDefault(undefined)
                  }}
                  onSave={onSaveProfile}
                  defaultValue={formDefault}
                  speakers={Array.from(
                    new Set(task?.dialogue?.map((t) => t.speaker).filter(Boolean)),
                  )}
                  {...(editingId == null
                    ? { draftLang: lang, draftTaskId: taskId }
                    : {})}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
