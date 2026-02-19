import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import segmentsData from '../videoSegments.json'

const WATCH_THRESHOLD = 95

function parseTimeToSeconds(v) {
  if (v == null) return 0
  if (typeof v === 'number') return Math.max(0, Math.floor(v))
  const parts = String(v).split(':').map((p) => Number(p))
  if (parts.length === 1) return Math.floor(parts[0])
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

function extractVideoId(videoId) {
  if (!videoId) return null
  if (typeof videoId !== 'string') return null
  // Common YouTube URL forms
  const byWatch = videoId.match(/[?&]v=([^&#]+)/)
  if (byWatch) return byWatch[1]
  const byShort = videoId.match(/youtu\.be\/([^&#]+)/)
  if (byShort) return byShort[1]
  // already an id
  return videoId
}

export default function VideoSegments({
  lang,
  movie,
  currentIndex,
  showSegments = true,
  showStart = true,
}) {
  const navigate = useNavigate()
  const key = String(movie || '')
  const meta = segmentsData[key]

  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const progressIntervalRef = useRef(null)

  const [allowedToStart, setAllowedToStart] = useState(false)
  const [watchedPercent, setWatchedPercent] = useState(0)
  const [duration, setDuration] = useState(0)

  const storageKey = `video_watched_${lang}_${movie}`

  // If previously watched, allow start
  useEffect(() => {
    if (!meta) return
    try {
      const v = window.localStorage.getItem(storageKey)
      if (v === 'true') setAllowedToStart(true)
    } catch (e) {}
  }, [meta, storageKey])

  // Ensure YT API and create player
  useEffect(() => {
    if (!meta || !meta.videoId) return undefined
    let mounted = true

    function ensureYouTubeAPI() {
      return new Promise((resolve) => {
        if (window.YT && window.YT.Player) return resolve(window.YT)
        if (document.getElementById('yt-iframe-api')) {
          // wait for global ready callback
          const onReady = () => resolve(window.YT)
          const prev = window.onYouTubeIframeAPIReady
          window.onYouTubeIframeAPIReady = function () {
            if (typeof prev === 'function') prev()
            onReady()
          }
          return
        }
        const tag = document.createElement('script')
        tag.id = 'yt-iframe-api'
        tag.src = 'https://www.youtube.com/iframe_api'
        const firstScriptTag = document.getElementsByTagName('script')[0]
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
        window.onYouTubeIframeAPIReady = () => resolve(window.YT)
      })
    }

    let player = null

    ensureYouTubeAPI().then((YT) => {
      if (!mounted) return
      const id = extractVideoId(meta.videoId)
      if (!id) return

      // parse skip segments and prepare runtime state
      const parsedSkip = (meta.skipSegments || []).map((s) => ({
        start: parseTimeToSeconds(s.start),
        end: parseTimeToSeconds(s.end),
        label: s.label || '',
      }))

      // Testing helper: when true, do not automatically revert forward seeks.
      // Set to `false` in production once behavior is validated.
      const TEST_DISABLE_REVERT = true

      let allowedMax = 0 // furthest time the user has legitimately watched
      let lastPollTime = 0
      let pausedAtSegmentEnd = false
      let cumulativeWatchedOnRequired = 0
      let totalRequiredDuration = 0
      let pollingIntervalMs = 250

      // helper to seek and robustly resume playback (handles YouTube buffering/autoplay races)
      function seekAndPlay(target) {
        try {
          player.seekTo(target, true)
        } catch (err) {}
        // Try to play immediately and a couple of times after short delays to handle buffering/autoplay
        try {
          if (typeof player.playVideo === 'function') player.playVideo()
        } catch (e) {}
        setTimeout(() => {
          try {
            if (typeof player.playVideo === 'function') player.playVideo()
          } catch (e) {}
        }, 200)
        setTimeout(() => {
          try {
            if (typeof player.playVideo === 'function') player.playVideo()
          } catch (e) {}
        }, 700)
      }

      player = new YT.Player(containerRef.current, {
        videoId: id,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (e) => {
            try {
              const d = e.target.getDuration()
              setDuration(d)
              // compute total required duration = total duration minus skip segments
              const clamp = (v) => Math.max(0, Math.min(d, v))
              const skipTotal = parsedSkip.reduce((acc, s) => acc + Math.max(0, clamp(s.end) - clamp(s.start)), 0)
              totalRequiredDuration = Math.max(0, d - skipTotal)
            } catch (err) {}

            if (meta?.segments && Array.isArray(meta.segments)) {
              const seg = meta.segments.find(
                (s) => Number(s.taskIndex) === Number(currentIndex),
              )
              if (seg) {
                const start = parseTimeToSeconds(seg.start)
                try {
                  e.target.seekTo(start, true)
                } catch (err) {}
              }
            }
          },
          onStateChange: (e) => {
            const YTState = window.YT?.PlayerState || {}
            if (e.data === YTState.PLAYING) {
              if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
              progressIntervalRef.current = setInterval(() => {
                try {
                  const current = player.getCurrentTime()
                  const total = player.getDuration() || duration || 0

                  // detect forward seek beyond allowedMax
                  if (Math.abs(current - lastPollTime) > 2 && current > allowedMax + 0.5) {
                    // If the user jumped forward beyond allowedMax, only allow it when the
                    // entire interval (allowedMax, jumpedTo) contains no required content —
                    // i.e., is fully covered by skip segments. Otherwise revert.
                    const jumpedTo = current

                    // helper: compute whether [start,end) is covered by skip ranges and
                    // how much uncovered (required) time exists in that interval
                    function computeSkipCoverage(start, end) {
                      if (start >= end) return { covered: true, uncovered: 0 }
                      const relevant = parsedSkip
                        .map((s) => ({ start: s.start, end: s.end }))
                        .filter((s) => s.end > start && s.start < end)
                        .sort((a, b) => a.start - b.start)
                      let cursor = start
                      let uncovered = 0
                      for (const s of relevant) {
                        if (s.start > cursor) {
                          uncovered += Math.max(0, s.start - cursor)
                        }
                        cursor = Math.max(cursor, s.end)
                        if (cursor >= end) break
                      }
                      if (cursor < end) uncovered += Math.max(0, end - cursor)
                      return { covered: uncovered <= 0.01, uncovered }
                    }

                    const landedInSkip = parsedSkip.find((s) => jumpedTo >= s.start && jumpedTo <= s.end + 0.5)
                      if (landedInSkip) {
                      try {
                        const jumpTo = Math.min(landedInSkip.end + 0.05, total || landedInSkip.end + 0.05)
                        seekAndPlay(jumpTo)
                        allowedMax = Math.max(allowedMax, jumpTo)
                        lastPollTime = jumpTo
                        return
                      } catch (err) {}
                    }
                    // compute if the interval between allowedMax and jumpedTo is fully covered
                    // by skips, and how much required time (uncovered) exists
                    const { covered, uncovered } = computeSkipCoverage(allowedMax, jumpedTo)
                    const TOLERANCE_SEC = 1.5 // allow small uncovered gaps (in seconds)
                    const ALLOW_AFTER_SKIP_SEC = 2.0 // allow clicks up to this many seconds after a skip end
                    // debug log to help diagnose reverts (will appear in browser console)
                    try {
                      // eslint-disable-next-line no-console
                      console.debug('seek-check', { allowedMax, jumpedTo, covered, uncovered, TEST_DISABLE_REVERT })
                    } catch (e) {}

                    // allow if fully covered, within uncovered tolerance, OR user clicked inside/just after a skip
                    const landedInsideOrAfterSkip = parsedSkip.find((s) => jumpedTo >= s.start && jumpedTo <= s.end + ALLOW_AFTER_SKIP_SEC)

                    if (covered || uncovered <= TOLERANCE_SEC || landedInsideOrAfterSkip) {
                      // if landed inside/after skip, seek to skip end for a clean position
                      if (landedInsideOrAfterSkip) {
                        try {
                          const jumpTo = Math.min(landedInsideOrAfterSkip.end + 0.05, total || landedInsideOrAfterSkip.end + 0.05)
                          seekAndPlay(jumpTo)
                          allowedMax = Math.max(allowedMax, jumpTo)
                          lastPollTime = jumpTo
                          return
                        } catch (err) {}
                      }
                      // otherwise allow the jump and update allowedMax
                      allowedMax = Math.max(allowedMax, jumpedTo)
                    } else {
                      // user illegally jumped forward — in testing mode we DO NOT revert
                      try {
                        // eslint-disable-next-line no-console
                        console.debug('revert-suppressed', { allowedMax, jumpedTo, uncovered, TEST_DISABLE_REVERT })
                      } catch (err) {}
                      if (!TEST_DISABLE_REVERT) {
                        try {
                          player.seekTo(Math.max(0, allowedMax) + 0.05, true)
                          return
                        } catch (err) {}
                      }
                      // when TEST_DISABLE_REVERT is true we simply allow the jump for debugging
                      allowedMax = Math.max(allowedMax, jumpedTo)
                    }
                  }

                  // check if we're inside a skip segment — if so, jump to its end
                  const inSkip = parsedSkip.find((s) => current >= s.start && current < s.end)
                  if (inSkip) {
                    try {
                      const jumpTo = Math.min(inSkip.end + 0.05, total || inSkip.end + 0.05)
                      seekAndPlay(jumpTo)
                      allowedMax = Math.max(allowedMax, jumpTo)
                      lastPollTime = jumpTo
                      return
                    } catch (err) {}
                  }

                  // If this player is currently showing a defined (required) segment for the
                  // current task index, pause the player when we reach its end so the user
                  // can complete the task before continuing.
                  if (meta?.segments && Array.isArray(meta.segments)) {
                    const curSeg = meta.segments.find(
                      (s) => Number(s.taskIndex) === Number(currentIndex),
                    )
                    if (curSeg && curSeg.end != null) {
                      const segEnd = parseTimeToSeconds(curSeg.end)
                      // trigger pause only once when crossing the end boundary
                      if (!pausedAtSegmentEnd && current >= segEnd - 0.12) {
                        pausedAtSegmentEnd = true
                        try {
                          if (typeof player.pauseVideo === 'function') player.pauseVideo()
                        } catch (e) {}
                        allowedMax = Math.max(allowedMax, segEnd)
                        // mark watched enough to allow Start/Next actions
                        setAllowedToStart(true)
                        try { window.localStorage.setItem(storageKey, 'true') } catch (e) {}
                        // continue — we don't return here so the UI updates below still run
                      }
                      if (current < segEnd - 0.5) {
                        // reset guard if user seeks back into the segment
                        pausedAtSegmentEnd = false
                      }
                    }
                  }

                  // accumulate watched time on required parts (approximate by delta)
                  if (lastPollTime && current > lastPollTime) {
                    // only add delta if both last and current are not inside skip segments
                    const lastInSkip = parsedSkip.some((s) => lastPollTime >= s.start && lastPollTime < s.end)
                    const curInSkip = parsedSkip.some((s) => current >= s.start && current < s.end)
                    if (!lastInSkip && !curInSkip) {
                      cumulativeWatchedOnRequired += Math.max(0, current - lastPollTime)
                    }
                  }

                  // update allowed max
                  if (current > allowedMax) allowedMax = current

                  // compute watched percent relative to required duration when available
                  const pct = totalRequiredDuration > 0 ? Math.min(100, (cumulativeWatchedOnRequired / totalRequiredDuration) * 100) : 0
                  setWatchedPercent(pct)

                  if (pct >= WATCH_THRESHOLD) {
                    setAllowedToStart(true)
                    try {
                      window.localStorage.setItem(storageKey, 'true')
                    } catch (e) {}
                    clearInterval(progressIntervalRef.current)
                    progressIntervalRef.current = null
                  }

                  lastPollTime = current
                } catch (err) {}
              }, pollingIntervalMs)
            } else if (e.data === YTState.PAUSED || e.data === YTState.ENDED) {
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current)
                progressIntervalRef.current = null
              }
            }
          },
        },
      })

      playerRef.current = player
    })

    return () => {
      mounted = false
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy()
        } catch (e) {}
      }
      playerRef.current = null
    }
  }, [meta, duration, storageKey])

  // Seek when switching tasks
  useEffect(() => {
    if (!meta || !Array.isArray(meta.segments)) return
    const seg = meta.segments.find((s) => Number(s.taskIndex) === Number(currentIndex))
    if (seg && playerRef.current && typeof playerRef.current.seekTo === 'function') {
      const start = parseTimeToSeconds(seg.start)
      try {
        playerRef.current.seekTo(start, true)
      } catch (e) {}
    }
  }, [currentIndex, meta])

  if (!meta) return null

  const onStart = () => {
    navigate(`/task/${encodeURIComponent(lang)}/${encodeURIComponent(movie)}/0`)
  }

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 520px', minWidth: 320 }}>
            <div style={{ position: 'relative', paddingTop: '56.25%' }}>
              <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            </div>

            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round(watchedPercent))}%`,
                      height: '100%',
                      background: watchedPercent >= 90 ? '#10b981' : '#3b82f6',
                    }}
                  />
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Watched: {Math.round(watchedPercent)}%{allowedToStart ? ' — Ready' : ''}
                </div>
              </div>

              {showStart && (
                <button className="btn" onClick={onStart} disabled={!allowedToStart}>
                  Start
                </button>
              )}
            </div>
          </div>

          {showSegments && (
            <div style={{ flex: '0 1 320px', minWidth: 220 }}>
              <h4 style={{ marginTop: 0 }}>{meta.title || movie}</h4>
              <p className="muted">Click a colored segment to open its task.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {(meta.segments || []).map((s, idx) => {
                  const start = parseTimeToSeconds(s.start)
                  const end = s.end != null ? parseTimeToSeconds(s.end) : null
                  const label = s.label || `Segment ${idx + 1}`
                  return (
                    <button
                      key={idx}
                      className="btn"
                      onClick={() => {
                        navigate(`/task/${encodeURIComponent(lang)}/${encodeURIComponent(movie)}/${s.taskIndex}`)
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: s.color || '#eee',
                        color: '#000',
                      }}
                    >
                      <span>{label}</span>
                      <small style={{ opacity: 0.85 }}>
                        {start != null ? `${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')}` : ''}
                        {end != null ? ` — ${Math.floor(end / 60)}:${String(end % 60).padStart(2, '0')}` : ''}
                      </small>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
