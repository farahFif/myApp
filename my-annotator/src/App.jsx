import React, { useState } from "react";
// import tasks from "./tasks.json";
import "./index.css"; // <-- must import Tailwind here
import task_fr from "./task_fr.json";
import task_ar from "./task_ar.json";
import task_hi from "./task_hi.json";
import task_bn from "./task_bn.json";


const scoringConfig = {
  default: [0, 1, 2],
  dialogues: [0,1,2],
  memory: [0,1,2],
  Gender: [0,1],
  Power: [0,1,2],
  Location: [0,1,2],
  Formality: [0, 1],
  Speakers:  [0,1,2],
  Name: [0,1],
  Age:  [0,1,2],
  Occupation: [0,1],
  Religion: [0,1],
  Ethnicity: [0,1],
  Country: [0,1],
  Fame: [0,1],
  Education: [0,1]
};
const renderRelationships = (relationships) => {
  return relationships.map((rel, i) => {
    const entries = Object.entries(rel);
    if (entries.length === 2) {
      const [[subj, relation], [obj, inverse]] = entries;
      return (
        <div key={i} style={{ marginBottom: "6px" }}>
          {subj} <strong>{relation}</strong> {obj}
        </div>
      );
    } else {
      // fallback if the object isn’t exactly two entries
      return (
        <div key={i}>
          {entries.map(([k, v]) => (
            <div key={k}>
              {k} <strong>{v}</strong>
            </div>
          ))}
        </div>
      );
    }
  });
};

const renderValue = (val) => {
  if (Array.isArray(val)) {
    return val.map((item, i) =>
      typeof item === "object" ? (
        <div key={i} style={{ marginLeft: "15px" }}>
          {Object.entries(item).map(([k, v]) => (
            <div key={k}>
              <strong>{k}:</strong> {v}
            </div>
          ))}
        </div>
      ) : (
        <div key={i}>{item}</div>
      )
    );
  } else if (typeof val === "object" && val !== null) {
    return (
      <div style={{ marginLeft: "15px" }}>
        {Object.entries(val).map(([k, v]) => (
          <div key={k}>
            <strong>{k}:</strong> {v}
          </div>
        ))}
      </div>
    );
  } else {
    return val;
  }
};

function ScoreSelect({ taskIndex, field, subField, value, onChange }) {
  const range =
    scoringConfig[field] ||
    scoringConfig[subField] ||
    scoringConfig.default;

  return (
    <select
      value={value || ""}
      onChange={(e) =>
        onChange(field, subField, e.target.value)
      }
    className="
        px-3 py-1
        border border-gray-300
        rounded-md
        bg-white text-gray-700 text-sm
        shadow-sm
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
        transition
      "
    >
      <option value="">Select score</option>
      {range.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}
// ... keep your imports and ScoreSelect component as is

export default function App() {
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState({});
  const [language, setLanguage] = useState(null);

  //   const task = tasks[index].data;
  const tasksByLang = {
    French: task_fr,
    Arabic: task_ar,
    Hindi: task_hi,
    Bengali: task_bn
  };
  const tasks = language ? tasksByLang[language] || [] : [];
  const task = tasks[index]?.data;
  console.log("Language:", language);
  console.log("Tasks:", tasks);
  console.log("Task[0]:", task);

  const handleScoreChange = (field, subField, value) => {
    setScores((prev) => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]:
          subField !== null
            ? {
                ...(prev[index]?.[field] || {}),
                [subField]: value
              }
            : value
      }
    }));
  };

  // --- NEW FUNCTION: check if all scores are filled for current task
  const isTaskComplete = () => {
    const taskScores = scores[index] || {};

    // 1. Dialogues overall score
    if (task.dialogues && !taskScores.dialogues_overall) return false;

    // 2. Memory score
    if (task.memory && !taskScores.memory) return false;

    // 3. Profiles
    if (task.profiles) {
      for (let i = 0; i < task.profiles.length; i++) {
        const profile = task.profiles[i];
        const profileScores = taskScores[`profiles_${i}`] || {};
        for (let key of Object.keys(profile)) {
          if (key === "Name") continue;
          if (
            profileScores[key] === undefined ||
            profileScores[key] === ""
          )
            return false;
        }
      }
    }

    // 4. Other scored fields (everything else except dialogues, memory, profiles)
    for (let key of Object.keys(task)) {
      if (["dialogues", "memory", "profiles"].includes(key)) continue;
      if (
        taskScores[key] === undefined ||
        taskScores[key] === ""
      )
        return false;
    }

    return true;
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(scores, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scores-${language}.json`;
    a.click();
  };
// --- Language selection page ---
  if (!language) {
    const languages = Object.keys(tasksByLang);

    return (
      <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
        <h2>Select a language</h2>
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => {
              setLanguage(lang);
              setIndex(0); // reset index
              setScores({});
            }}
            style={{
              display: "block",
              margin: "10px 0",
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              cursor: "pointer"
            }}
          >
            {lang}
          </button>
        ))}
      </div>
    );
  }

  // --- If no tasks ---
  if (tasks.length === 0) {
    return (
      <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
        <h2>No tasks found for language: {language}</h2>
        <button onClick={() => setLanguage(null)}>Go back</button>
      </div>
    );
  }
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>
        Task {index + 1} / {tasks.length}
      </h2>

     {/* --- Dialogues first --- */}
{task.dialogues && (
  <div
    style={{
      border: "2px solid #444",
      borderRadius: "8px",
      padding: "10px",
      marginBottom: "20px",
      background: "#fafafa",
      colorScheme: "light", // 👈 Prevents forced dark mode inversion
    }}
  >
    <div className="no-dark" style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <h3 style={{ margin: 0 }}>Dialogues</h3>
      <ScoreSelect
        field="dialogues_overall"
        subField={null}
        value={scores[index]?.dialogues_overall || ""}
        onChange={handleScoreChange}
      />
    </div>
    <div className="no-dark"
      style={{
        maxHeight: "250px",
        overflowY: "auto",
        padding: "8px",
        background: "white",
        border: "1px solid #ddd",
        borderRadius: "6px",
        fontFamily: "monospace",
        whiteSpace: "pre-wrap",
        marginTop: "10px",
        colorScheme: "light", // 👈 Added here too
      }}
    >
      {task.dialogues.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  </div>
)}

{/* --- Memory second --- */}
{task.memory && (
  <div className="no-dark"
    style={{
      border: "2px solid #888",
      borderRadius: "8px",
      padding: "10px",
      marginBottom: "20px",
      background: "#f9f9f9",
      colorScheme: "light", // 👈 Fix for memory box
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <h3 style={{ margin: 0 }}>Memory</h3>
      <ScoreSelect
        field="memory"
        subField={null}
        value={scores[index]?.memory || ""}
        onChange={handleScoreChange}
      />
    </div>
    <p style={{ marginTop: 8 }}>{task.memory}</p>
  </div>
)}

      {/* --- Profiles and other fields --- */}
      {Object.entries(task).map(([key, value]) => {
        if (key === "dialogues" || key === "memory") return null;

        if (key === "profiles" && Array.isArray(value)) {
          return (
            <div key={key} style={{ marginBottom: "20px" }}>
              <h2>Profiles</h2>
              {value.map((profile, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    padding: "10px",
                    marginBottom: "10px"
                  }}
                >
                  <h3 className="h3_nom">{profile.Name}</h3>
                  {Object.entries(profile).map(([attrKey, attrValue]) => {
                    if (attrKey === "Name") return null;
                    return (
                      <div key={attrKey} style={{ marginBottom: "10px" }}>
                        <strong>{attrKey}:</strong>{" "}
                       {Array.isArray(value)
                          ? value.join(", ")
                          : typeof value === "object"
                          ? JSON.stringify(value)
                          : value}

                        <div style={{ marginLeft: "10px", marginTop: "10px" }}>
                          <ScoreSelect
                            taskIndex={index}
                            field={`profiles_${i}`}
                            subField={attrKey}
                            value={
                              scores[index]?.[`profiles_${i}`]?.[attrKey] || ""
                            }
                            onChange={handleScoreChange}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        }

        // Normal fields
        return (
          <div
            key={key}
            style={{
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "10px",
              marginBottom: "10px"
            }}
          >
            <strong>{key}:</strong>{" "}
            {key === "Relationships" ? renderRelationships(value) : renderValue(value)}
            <div style={{ marginLeft: "10px", marginTop: "10px" }}>
              <ScoreSelect
                taskIndex={index}
                field={key}
                subField={null}
                value={scores[index]?.[key] || ""}
                onChange={handleScoreChange}
              />
            </div>
          </div>
        );
      })}

      {/* --- Navigation --- */}
      <div style={{ marginTop: "20px" }}>
        <button
          onClick={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0}
        >
          Previous
        </button>
        <button
          onClick={() => setIndex(Math.min(tasks.length - 1, index + 1))}
          disabled={!isTaskComplete() || index === tasks.length - 1}
          style={{ marginLeft: "10px", opacity: !isTaskComplete() ? 0.5 : 1 }}
        >
          Next
        </button>
        <button
          onClick={handleExport}
          style={{ marginLeft: "10px", background: "lightgreen" }}
        >
          Export Scores
        </button>
      </div>
    </div>
  );
}
