import React from 'react'

export default function Dialogue({ turns = [] }) {
  return (
    <div
      // Keep the dialogue box wide, but add vertical scroll for long content
      style={{
        maxHeight: '60vh',
        overflowY: 'auto',
        paddingRight: 8, // room for scrollbar
      }}
    >
      {turns.length === 0 ? (
        <p className="muted">No dialogue for this task.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {turns.map((t, idx) => (
            <li
              key={idx}
              style={{
                padding: '8px 10px',
                borderBottom: '1px solid var(--border, #e6e6e6)',
              }}
            >
              <strong>{t.speaker || 'Speaker'}:</strong>{' '}
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
