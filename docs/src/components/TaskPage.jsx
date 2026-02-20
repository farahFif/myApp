import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Dialogue from './Dialogue.jsx'
import Summary from './Summary.jsx'
import ProfileForm from './ProfileForm.jsx'
import SpeakersDynamics from './SpeakersDynamics.jsx'
import DialogContext from './DialogContext.jsx'
import segmentsData from '../videoSegments.json'
// import AnnotatorPerspective from './AnnotatorPerspective.jsx' // kept commented for future use
import RemarksBox from './RemarksBox.jsx'
import VideoSegments from './VideoSegments.jsx'

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

// ----- helpers -----

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

// supports array or object with numeric keys "0","1",...
function dialoguesToTurns(rawDialogues) {
  if (Array.isArray(rawDialogues)) return toTurnsFromStrings(rawDialogues)
  if (rawDialogues && typeof rawDialogues === 'object') {
    const keys = Object.keys(rawDialogues)
      .filter((k) => String(Number(k)) === k)
      .sort((a, b) => Number(a) - Number(b))
    const lines = keys.map((k) => rawDialogues[k])
    return toTurnsFromStrings(lines)
  }
  return []
}

// normalise a task from different JSON shapes
function normalizeTask(raw, i) {
  // old shape: { data: { dialogues:[], memory:"" } }
  if (raw?.data) {
    const d = raw.data
    const dialogue =
      Array.isArray(d.dialogues)
        ? toTurnsFromStrings(d.dialogues)
        : Array.isArray(d.dialogue)
          ? (typeof d.dialogue[0] === 'string' ? toTurnsFromStrings(d.dialogue) : d.dialogue)
          : []

    const overallsummary =
      d.overallsummary ??
      d.overallSummary ??
      d.memory ??
      d.summary ??
      d.summ ??
      d.overview ??
      ''

    const scenedetails =
      d.scenedetails ??
      d.sceneDetails ??
      d.scene ??
      d.scenedetail ??
      ''

    return {
      id: raw.id ?? d.id ?? i,
      dialogue,
      overallsummary,
      scenedetails,
      summary: overallsummary, // legacy
      question: d.question ?? raw.question ?? '',
      yesno: d.yesno ?? raw.yesno ?? '',
    }
  }

  // new shape (e.g. your French example)
  const dialogue =
    raw?.Dialogues != null
      ? dialoguesToTurns(raw.Dialogues)
      : raw?.dialogues != null
        ? dialoguesToTurns(raw.dialogues)
        : []

  const overallsummary =
    raw?.overallsummary ??
    raw?.overallSummary ??
    raw?.overall_summary ??
    raw?.summary ??
    raw?.memory ??
    ''

  const scenedetails =
    raw?.scenedetails ??
    raw?.sceneDetails ??
    raw?.scene_details ??
    raw?.scenedetail ??
    ''

  return {
    id: raw?.id ?? i,
    dialogue,
    overallsummary,
    scenedetails,
    summary: overallsummary,
    question: raw?.question ?? '',
    yesno: raw?.yesno ?? raw?.answer ?? '',
  }
}

// ----- component -----

export default function TaskPage() {
  const { lang, movie, index } = useParams()
  const navigate = useNavigate()

  const base = import.meta.env.BASE_URL || '/'
  // composite key so annotations don’t mix across movies
  const langKey = `${lang}__${movie}`

  const [catalog, setCatalog] = useState({})
  const [movieTitle, setMovieTitle] = useState(movie)
  const [taskFile, setTaskFile] = useState(null)

  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState(() => loadProfiles())
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formDefault, setFormDefault] = useState(undefined)

  // validation
  const [valid, setValid] = useState({
    all: false,
    profiles: false,
    dynamics: false,
    context: false,
    perspective: true, // annotator perspective not used in UI
  })
  const [showErrors, setShowErrors] = useState(false)

  const profilesRef = useRef(null)
  const dynamicsRef = useRef(null)
  const contextRef = useRef(null)
  const taskOpenedAtRef = useRef(Date.now())

  // local state for answer to honey-pot style question (NON-blocking)
  const [hpChoice, setHpChoice] = useState('') // 'yes' | 'no' | ''

  // ----- load catalog + resolve movie → file -----

  useEffect(() => {
    let cancelled = false
    async function loadCatalog() {
      try {
        const res = await fetch(`${base}data/catalog.json`, { cache: 'no-cache' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        setCatalog(data || {})

        const list = Array.isArray(data?.[lang]) ? data[lang] : []
        const found = list.find((m) => String(m.id) === String(movie))
        setMovieTitle(found?.title || movie)
        setTaskFile(found?.file || null)
      } catch (e) {
        console.error('catalog.json fetch failed:', e)
        if (!cancelled) {
          setCatalog({})
          setMovieTitle(movie)
          setTaskFile(null)
        }
      }
    }
    loadCatalog()
    return () => { cancelled = true }
  }, [base, lang, movie])

  // ----- load tasks for this (lang,movie) -----

  useEffect(() => {
    if (!taskFile) {
      setTasks([])
      return
    }
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${base}data/${taskFile}`, { cache: 'no-cache' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        let arr = []
        if (Array.isArray(data)) {
          arr = data
        } else if (Array.isArray(data?.tasks)) {
          arr = data.tasks
        } else if (data && typeof data === 'object') {
          // support object with numeric keys: { "0": {...}, "1": {...} }
          const numericKeys = Object.keys(data).filter((k) => String(Number(k)) === k)
          if (numericKeys.length > 0) {
            numericKeys.sort((a, b) => Number(a) - Number(b))
            arr = numericKeys.map((k) => data[k])
          } else {
            arr = []
          }
        }
        const normalized = arr.map((t, idx) => normalizeTask(t, idx))
        if (!cancelled) setTasks(normalized)
      } catch (e) {
        console.error(`${taskFile} fetch failed:`, e)
        if (!cancelled) setTasks([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [base, taskFile])

  const segmentIndex = Number.isFinite(Number(index)) ? Number(index) : 0
  const videoMeta = segmentsData?.[movie]
  const segments = Array.isArray(videoMeta?.segments) ? videoMeta.segments : null
  const hasSegments = !!(segments && segments.length > 0)
  const seg =
    hasSegments && segments
      ? segments.find((s) => Number(s.taskIndex) === Number(segmentIndex)) || segments[segmentIndex]
      : null
  const mappedIndex = hasSegments ? Number(seg?.mapping ?? seg?.taskIndex ?? segmentIndex) : segmentIndex

  const task = tasks[mappedIndex]
  const taskId = task?.id ?? mappedIndex

  // ----- time tracking: from task open until user clicks Next or Export -----
  useEffect(() => {
    taskOpenedAtRef.current = Date.now()
  }, [langKey, taskId])

  const recordCurrentTaskTime = () => {
    if (taskId === null || taskId === undefined) return
    const startedAt = taskOpenedAtRef.current || Date.now()
    const elapsedMs = Math.max(0, Date.now() - startedAt)
    saveTime(langKey, taskId, elapsedMs)
    // Reset anchor so repeated exports continue to reflect time since last action.
    taskOpenedAtRef.current = Date.now()
  }

  // ----- navigation -----

  const next = () => {
    const maxIndex = hasSegments ? Math.max(segments.length - 1, 0) : Math.max(tasks.length - 1, 0)
    navigate(
      `/task/${encodeURIComponent(lang)}/${encodeURIComponent(movie)}/${Math.min(
        segmentIndex + 1,
        maxIndex,
      )}`,
    )
  }

  const prev = () =>
    navigate(
      `/task/${encodeURIComponent(lang)}/${encodeURIComponent(movie)}/${Math.max(segmentIndex - 1, 0)}`,
    )

  // ----- profiles CRUD -----

  const openAddForm = () => {
    setEditingId(null)
    setFormDefault(loadDraft(langKey, taskId) || undefined)
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
      : { ...form, lang: langKey, taskId, savedAt: new Date().toISOString() }

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
    () => profiles.filter((p) => p.lang === langKey && p.taskId === taskId),
    [profiles, langKey, taskId],
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

  const inferEducationTier = (educationLevel) => {
    if (!educationLevel) return ''
    if (educationLevel === 'NA') return 'NA'
    const low = new Set(['Elementary', 'Secondary'])
    const medium = new Set(['High School', 'Diploma (technical or vocational)', 'High school', 'Diplomas'])
    const high = new Set(['Bachelor’s', 'Master’s', 'Doctoral'])
    if (low.has(educationLevel)) return 'Low Education'
    if (medium.has(educationLevel)) return 'Medium Education'
    if (high.has(educationLevel)) return 'Higher Education'
    return ''
  }

  // ----- validation -----

  function computeValidity() {
    const result = {
      profiles: false,
      dynamics: false,
      context: false,
      perspective: true,
      all: false,
    }

    // Profiles
    if (relatedProfiles.length > 0) {
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
      let ok = true
      outer: for (const p of relatedProfiles) {
        for (const f of requiredFields) {
          const v = p[f]
          if (v === null || v === undefined) { ok = false; break outer }
          if (typeof v === 'string' && v.trim() === '') { ok = false; break outer }
        }
        const tier = (p.educationTier || '').trim() || inferEducationTier(p.education)
        if (!tier) { ok = false; break outer }
      }
      result.profiles = ok
    }

    // Speakers Dynamics (touched edges)
    const dynamics = loadDynamics(langKey, taskId)
    if (dynamics?.edges) {
      const edges = Object.values(dynamics.edges)
      const touched = edges.filter((e) => e && (e.category || e.relation || e.familiarity))
      if (touched.length > 0) {
        result.dynamics = touched.every((e) => e.category && e.relation && e.familiarity)
      }
    }

    // Dialog Context
    const ctx = loadDialogContext(langKey, taskId)
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

      result.context = formalityFilled && (socialSettingFilled || domainFilled || privacyFilled)
    }

    result.all = result.profiles && result.dynamics && result.context && result.perspective
    return result
  }

  useEffect(() => {
    setValid(computeValidity())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatedProfiles, langKey, taskId])

  const handleNext = () => {
    recordCurrentTaskTime()
    const v = computeValidity()
    setValid(v)
    // Always show validation errors when not fully valid
    if (!v.all) setShowErrors(true)

    // If not valid, attempt to focus the first invalid section (optional)
    const order = [
      { ok: v.profiles, ref: profilesRef },
      { ok: v.dynamics, ref: dynamicsRef },
      { ok: v.context, ref: contextRef },
    ]
    const firstBad = order.find((s) => !s.ok)?.ref
    if (firstBad?.current) {
      try {
        firstBad.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } catch (e) {}
    }

    // Proceed to next task regardless of validity (unless already at last task)
    if (hasSegments) {
      if (segmentIndex < segments.length - 1) next()
    } else {
      if (segmentIndex < tasks.length - 1) next()
    }
  }

  // ----- export -----
  const isTaskFilledForExport = (taskProfiles, dynamics, dialogContext) => {
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

    // Profiles must exist and be complete
    if (!Array.isArray(taskProfiles) || taskProfiles.length === 0) return false
    for (const p of taskProfiles) {
      for (const f of requiredFields) {
        const v = p?.[f]
        if (v === null || v === undefined) return false
        if (typeof v === 'string' && v.trim() === '') return false
      }
      const tier = (p?.educationTier || '').trim() || inferEducationTier(p?.education)
      if (!tier) return false
    }

    // Dynamics must have at least one touched edge and all touched edges complete
    const edges = Object.values(dynamics?.edges || {})
    const touched = edges.filter((e) => e && (e.category || e.relation || e.familiarity))
    if (touched.length === 0) return false
    if (!touched.every((e) => e.category && e.relation && e.familiarity)) return false

    // Dialog context must be complete
    const socialSettingFilled =
      typeof dialogContext?.socialSetting === 'string' && dialogContext.socialSetting.trim() !== ''
    const domainFilled = Array.isArray(dialogContext?.locationDomain)
      ? dialogContext.locationDomain.length > 0
      : !!dialogContext?.locationDomain
    const privacyFilled = Array.isArray(dialogContext?.locationPrivacy)
      ? dialogContext.locationPrivacy.length > 0
      : !!dialogContext?.locationPrivacy
    const formalityFilled = !!dialogContext?.formality
    if (!(formalityFilled && (socialSettingFilled || domainFilled || privacyFilled))) return false

    return true
  }

  const onExport = () => {
    recordCurrentTaskTime()
    const allData = []
    const exportTaskIndexes = hasSegments
      ? Array.from(
          new Set(
            (segments || [])
              .map((s) => Number(s?.mapping ?? s?.taskIndex))
              .filter((n) => Number.isInteger(n) && n >= 0 && n < tasks.length),
          ),
        )
      : tasks.map((_, idx) => idx)

    exportTaskIndexes.forEach((taskIndex) => {
      const t = tasks[taskIndex]
      if (!t) return
      const thisTaskId = t.id ?? taskIndex
      const dynamics = loadDynamics(langKey, thisTaskId) || {}
      const dialogContext = loadDialogContext(langKey, thisTaskId) || {}
      const perspective = loadPerspective(langKey, thisTaskId) || {}
      const remarks = loadRemarks(langKey, thisTaskId) || ''
      const taskProfiles = profiles.filter(
        (p) => p.lang === langKey && p.taskId === thisTaskId,
      )
      const timeSpentMs = loadTime(langKey, thisTaskId) || 0
      const taskFilled = isTaskFilledForExport(taskProfiles, dynamics, dialogContext)
      if (!taskFilled) return

      allData.push({
        meta: {
          lang,
          movie,
          movieTitle,
          taskIndex,
          taskId: thisTaskId,
          exportedAt: new Date().toISOString(),
          timeSpentMs,
        },
        task: {
          dialogue: t.dialogue ?? [],
          overallsummary: t.overallsummary ?? '',
          scenedetails: t.scenedetails ?? '',
          question: t.question ?? '',
          yesno: t.yesno ?? '',
          // NOTE: hpChoice is not stored; if you want it, we could add it to storage.
        },
        profiles: taskProfiles,
        speakersDynamics: dynamics,
        dialogContext,
        annotatorPerspective: perspective,
        remarks,
      })
    })

    const exportPayload = {
      lang,
      movie,
      movieTitle,
      totalTasks: allData.length,
      exportedAt: new Date().toISOString(),
      annotations: allData,
    }

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const fname = `all_annotations_${lang}_${movie}.json`

    const a = document.createElement('a')
    a.href = url
    a.download = fname
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // ----- rendering -----

  if (!taskFile) {
    return (
      <section className="card">
        <h2>Missing movie mapping</h2>
        <p className="muted">
          Could not find this movie in <strong>public/data/catalog.json</strong> for language{' '}
          <strong>{lang}</strong>.
        </p>
      </section>
    )
  }

  if (!task) {
    return (
      <section className="card">
        <h2>No task for segment {segmentIndex}</h2>
        {hasSegments && (
          <p className="muted" style={{ marginTop: 6 }}>
            This segment maps to task index {mappedIndex}, which is missing in the tasks file.
          </p>
        )}
      </section>
    )
  }

  const errorCardStyle = (flag) =>
    showErrors && !flag ? { border: '2px solid #d9534f' } : {}

  const hasQuestion = (task.question ?? '').trim().length > 0

  return (
    <section
      className="grid"
      style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}
    >
          {/* Video + Segments (if configured in `videoSegments.json`) */}
          <VideoSegments
            lang={lang}
            movie={movie}
            currentIndex={segmentIndex}
            showSegments={false}
            showStart={false}
          />

      {/* Dialogue | Summary */}
      <div className="card">
        <h2>Dialogue</h2>
        <Dialogue turns={task.dialogue} />
      </div>

      {(task.overallsummary || task.scenedetails || task.summary) && (
        <div className="card">
          <h2>Summary</h2>
          <Summary
            overallsummary={task.overallsummary}
            scenedetails={task.scenedetails}
            text={task.summary}
          />
        </div>
      )}

      {/* Non-blocking comprehension question */}
      {hasQuestion && (
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="card">
            <h3>Comprehension question</h3>
            <p className="muted" style={{ marginTop: 4 }}>
              Answer based on the summary. This does not affect your ability to continue.
            </p>
            <div style={{ marginTop: 8 }}>
              <strong>{task.question}</strong>
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 14,
                  alignItems: 'center',
                }}
              >
                <label className="radio">
                  <input
                    type="radio"
                    name={`hp-${taskId}`}
                    value="yes"
                    checked={hpChoice === 'yes'}
                    onChange={() => setHpChoice('yes')}
                  />{' '}
                  Yes
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name={`hp-${taskId}`}
                    value="no"
                    checked={hpChoice === 'no'}
                    onChange={() => setHpChoice('no')}
                  />{' '}
                  No
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profiles */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div
          ref={profilesRef}
          className="card"
          style={errorCardStyle(valid.profiles)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3>Profiles for this task</h3>
            <button className="btn" onClick={openAddForm}>
              Add profile
            </button>
          </div>
          <p className="muted" style={{ marginTop: 4 }}>
            Define each speaker’s demographic and social profile. These profiles are used in
            Speakers Dynamics.
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
            lang={langKey}
            taskId={taskId}
            speakers={speakersFromProfiles}
            uiLang={lang}
          />
        </div>
      </div>

      {/* Dialog Context */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div ref={contextRef} style={errorCardStyle(valid.context)}>
          <DialogContext lang={langKey} taskId={taskId} />
        </div>
      </div>

      {/* Remarks */}
      <div style={{ gridColumn: '1 / -1' }}>
        <RemarksBox lang={langKey} taskId={taskId} />
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
          <button className="btn ghost" onClick={prev} disabled={segmentIndex === 0}>
            Previous
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={onExport}>
              Export JSON
            </button>
            {(() => {
              const atEnd = hasSegments
                ? segmentIndex >= Math.max((segments?.length || 0) - 1, 0)
                : segmentIndex >= Math.max(tasks.length - 1, 0)
              return (
                <button
                  className="btn"
                  onClick={handleNext}
                  disabled={!hasSegments || atEnd}
                  title={!hasSegments ? 'No more segments for this movie' : 'Next'}
                  style={!hasSegments ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  Next
                </button>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Profile popup with Dialogue side-by-side */}
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
                  uiLang={lang}
                  {...(editingId == null
                    ? { draftLang: langKey, draftTaskId: taskId }
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
