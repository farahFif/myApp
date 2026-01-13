export default function Summary({
  overallsummary,
  scenedetails,
  text, // fallback for older tasks
}) {
  // Backward compatibility:
  // - if only `text` is passed, treat it as overallsummary
  const overall = overallsummary ?? text ?? ''
  const scene = scenedetails ?? ''

  return (
    <div
      style={{
        maxHeight: '300px',      // 👈 controls scroll height
        overflowY: 'auto',
        paddingRight: 6,
      }}
    >
      {overall && (
        <div style={{ marginBottom: 12 }}>
          <strong>Overall Summary</strong>
          <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
            {overall}
          </p>
        </div>
      )}

      {scene && (
        <div>
          <strong>Scene Details</strong>
          <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
            {scene}
          </p>
        </div>
      )}

      {!overall && !scene && (
        <p className="muted">No summary available.</p>
      )}
    </div>
  )
}
