// ========================================================
// Profile storage
// ========================================================
const KEY = 'annotation_profiles_v1'

// --- internal helpers ---
function writeProfiles(list) { localStorage.setItem(KEY, JSON.stringify(list)) }
function genId() { return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` }

/** Load and migrate any legacy entries that don't have an id. */
export function loadProfiles() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    let mutated = false
    for (const p of arr) {
      if (!p.id) { p.id = genId(); mutated = true }
    }
    if (mutated) writeProfiles(arr)
    return arr
  } catch {
    return []
  }
}

export function saveProfile(profile) {
  const all = loadProfiles()
  const withId = profile.id ? profile : { ...profile, id: genId() }
  all.push(withId)
  writeProfiles(all)
  return all
}

export function updateProfile(id, data) {
  const all = loadProfiles()
  const idx = all.findIndex(p => p.id === id)
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...data, id }
    writeProfiles(all)
  }
  return all
}

export function deleteProfile(id) {
  if (!id) return loadProfiles()
  const all = loadProfiles().filter(p => p.id !== id)
  writeProfiles(all)
  return all
}

// ========================================================
// Draft autosave for ProfileForm
// ========================================================
const DRAFT_KEY = 'annotation_profile_draft_v1'

function readDraftStore() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
function writeDraftStore(obj) { localStorage.setItem(DRAFT_KEY, JSON.stringify(obj)) }
function draftId(lang, taskId) { return `${lang}:${taskId}` }

export function loadDraft(lang, taskId) {
  const store = readDraftStore()
  return store[draftId(lang, taskId)] || null
}
export function saveDraft(lang, taskId, data) {
  const store = readDraftStore()
  store[draftId(lang, taskId)] = data
  writeDraftStore(store)
}
export function clearDraft(lang, taskId) {
  const store = readDraftStore()
  delete store[draftId(lang, taskId)]
  writeDraftStore(store)
}

// ========================================================
// Speakers Dynamics storage (per language + task)
// ========================================================
const DYN_KEY = 'annotation_dynamics_v1'
function readDynStore() {
  try {
    const raw = localStorage.getItem(DYN_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
function writeDynStore(obj) { localStorage.setItem(DYN_KEY, JSON.stringify(obj)) }
function dynId(lang, taskId) { return `${lang}:${taskId}` }

/** { speakers: string[], edges: {...}, powers: {...} } */
export function loadDynamics(lang, taskId) {
  const s = readDynStore()
  return s[dynId(lang, taskId)] || null
}
export function saveDynamics(lang, taskId, data) {
  const s = readDynStore()
  s[dynId(lang, taskId)] = data
  writeDynStore(s)
  return data
}
export function clearDynamics(lang, taskId) {
  const s = readDynStore()
  delete s[dynId(lang, taskId)]
  writeDynStore(s)
}

// ========================================================
// Dialog Context storage (per language + task)
// ========================================================
const DC_KEY = (lang, taskId) => `dialogContext:${lang}:${taskId}`

export function loadDialogContext(lang, taskId) {
  try {
    const raw = localStorage.getItem(DC_KEY(lang, taskId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveDialogContext(lang, taskId, payload) {
  try {
    localStorage.setItem(DC_KEY(lang, taskId), JSON.stringify(payload))
  } catch {
    // ignore quota errors
  }
}

export function clearDialogContext(lang, taskId) {
  try {
    localStorage.removeItem(DC_KEY(lang, taskId))
  } catch {
    // ignore
  }
}
// ========================================================
// Annotator Perspective storage (per language + task)
// ========================================================
const AP_KEY = 'annotation_perspective_v1'
function readApStore() {
  try {
    const raw = localStorage.getItem(AP_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
function writeApStore(obj) {
  localStorage.setItem(AP_KEY, JSON.stringify(obj))
}
function apId(lang, taskId) { return `${lang}:${taskId}` }

/** Shape: { speakers: string[], pairs: { "A | B": { powerDiff, socialDiff, intentAlign } } } */
export function loadPerspective(lang, taskId) {
  const s = readApStore()
  return s[apId(lang, taskId)] || null
}
export function savePerspective(lang, taskId, data) {
  const s = readApStore()
  s[apId(lang, taskId)] = data
  writeApStore(s)
  return data
}
export function clearPerspective(lang, taskId) {
  const s = readApStore()
  delete s[apId(lang, taskId)]
  writeApStore(s)
}

// ========================================================
// Remarks storage (per language + task)
// ========================================================
const RM_KEY = 'annotation_remarks_v1'
function readRmStore() {
  try {
    const raw = localStorage.getItem(RM_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
function writeRmStore(obj) {
  localStorage.setItem(RM_KEY, JSON.stringify(obj))
}
function rmId(lang, taskId) { return `${lang}:${taskId}` }

export function loadRemarks(lang, taskId) {
  const s = readRmStore()
  return s[rmId(lang, taskId)] || ''
}
export function saveRemarks(lang, taskId, text) {
  const s = readRmStore()
  s[rmId(lang, taskId)] = text
  writeRmStore(s)
  return text
}
export function clearRemarks(lang, taskId) {
  const s = readRmStore()
  delete s[rmId(lang, taskId)]
  writeRmStore(s)
}

// ========================================================
// Time tracking per task (active time in ms)
// ========================================================
// ========================================================
// Time tracking per task (active time in ms)
// ========================================================
// ========================================================
// Time tracking per task (active time in ms)
// ========================================================
const TIME_KEY = 'annotation_time_v1'

function readTimeStore() {
  try {
    const raw = localStorage.getItem(TIME_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeTimeStore(obj) {
  localStorage.setItem(TIME_KEY, JSON.stringify(obj))
}

function timeId(lang, taskId) {
  return `${lang}:${taskId}`
}

// Get total time (ms) spent on a specific task
export function loadTime(lang, taskId) {
  const store = readTimeStore()
  return store[timeId(lang, taskId)] || 0
}

// Overwrite stored time for a specific task
export function saveTime(lang, taskId, ms) {
  const store = readTimeStore()
  store[timeId(lang, taskId)] = ms
  writeTimeStore(store)
  return ms
}
