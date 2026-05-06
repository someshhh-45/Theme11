import { useState } from "react";
import ConfidenceBadge from "./ConfidenceBadge";

export default function EditableField({ label, value, confidence, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  return (
    <div style={{ marginBottom: 20, padding: 16, background: confidence < 60 ? "#fff5f5" : "#fff", border: `1px solid ${confidence < 60 ? "#fca5a5" : "#e2e8f0"}`, borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
        <ConfidenceBadge score={confidence} />
      </div>
      {editing ? (
        <>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
            style={{ width: "100%", minHeight: 80, border: "1px solid #93c5fd", borderRadius: 6, padding: 8, fontSize: 14, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={save} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 13 }}>Save</button>
            <button onClick={cancel} style={{ background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#1e293b", lineHeight: 1.6 }}>{value || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Not found</span>}</p>
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#64748b", marginLeft: 12, flexShrink: 0 }}>Edit</button>
        </div>
      )}
    </div>
  );
}