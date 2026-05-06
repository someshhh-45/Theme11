import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getReview, verifyCase, rejectCase } from "../api/client";
import EditableField from "../components/EditableField";

const FIELDS = [
  { key: "case_number", label: "Case Number" },
  { key: "case_title", label: "Case Title" },
  { key: "date_of_order", label: "Date of Order" },
  { key: "parties_involved", label: "Parties Involved" },
  { key: "key_directions", label: "Key Directions / Orders" },
  { key: "compliance_requirements", label: "Compliance Requirements" },
  { key: "appeal_consideration", label: "Appeal Consideration" },
  { key: "timelines", label: "Timelines" },
  { key: "responsible_departments", label: "Responsible Departments" },
];

export default function ReviewPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [edited, setEdited] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    getReview(caseId)
      .then((res) => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [caseId]);

  const getField = (key) => edited[key] ?? data?.extraction?.[key] ?? "";
  const getConf = (key) => data?.confidence?.[key] ?? 0;
  const updateField = (key, val) => setEdited((e) => ({ ...e, [key]: val }));

  const handleApprove = async () => {
    setSubmitting(true);
    const finalData = {};
    FIELDS.forEach(({ key }) => { finalData[key] = getField(key); });
    await verifyCase(caseId, finalData);
    navigate("/dashboard");
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setSubmitting(true);
    await rejectCase(caseId, rejectReason);
    navigate("/dashboard");
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading case data...</div>;
  if (!data) return <div style={{ padding: 40, color: "#dc2626" }}>Failed to load case. <a href="/upload">Go back</a></div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Review Extraction</h1>
          <span style={styles.caseId}>Case ID: {caseId}</span>
        </div>
        <a href="/dashboard" style={styles.dashLink}>→ Dashboard</a>
      </header>

      <div style={styles.body}>
        {/* LEFT: PDF Viewer */}
        <div style={styles.leftPanel}>
          <h3 style={styles.panelTitle}>Source Document</h3>
          <iframe
            src={`http://localhost:8000/pdf/${caseId}`}
            style={styles.pdfFrame}
            title="PDF Viewer"
          />
        </div>

        {/* RIGHT: Extracted Fields */}
        <div style={styles.rightPanel}>
          <h3 style={styles.panelTitle}>Extracted Information</h3>
          {FIELDS.map(({ key, label }) => (
            <EditableField
              key={key}
              label={label}
              value={getField(key)}
              confidence={getConf(key)}
              onChange={(val) => updateField(key, val)}
            />
          ))}

          {/* Action Plan */}
          {data.action_plan && (
            <div style={styles.actionBox}>
              <h4 style={styles.actionTitle}>AI Action Plan</h4>
              <div style={styles.actionGrid}>
                <ActionItem label="Action Required" value={data.action_plan.action_type} />
                <ActionItem label="Responsible Dept." value={data.action_plan.responsible_dept} />
                <ActionItem label="Primary Deadline" value={data.action_plan.primary_deadline} />
                <ActionItem label="If No Action" value={data.action_plan.consequence} />
              </div>
              <div style={{ marginTop: 16 }}>
                <span style={styles.actionLabel}>Steps to Take</span>
                <ul style={styles.stepsList}>
                  {(data.action_plan.steps || []).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>
          )}

          {/* Decision Buttons */}
          <div style={styles.buttons}>
            <button onClick={handleApprove} disabled={submitting} style={styles.approveBtn}>
              ✓ Approve & Verify
            </button>
            <button onClick={() => setShowReject(!showReject)} style={styles.rejectBtn}>
              ✗ Reject
            </button>
          </div>

          {showReject && (
            <div style={styles.rejectBox}>
              <textarea
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={styles.rejectInput}
              />
              <button onClick={handleReject} disabled={submitting || !rejectReason.trim()} style={styles.confirmReject}>
                Confirm Rejection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionItem({ label, value }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{value || "—"}</div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f1f5f9", fontFamily: "Georgia, serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", background: "#1e293b" },
  title: { color: "#f8fafc", fontSize: 20, margin: 0 },
  caseId: { color: "#94a3b8", fontSize: 13 },
  dashLink: { color: "#94a3b8", textDecoration: "none", fontSize: 14 },
  body: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, height: "calc(100vh - 64px)" },
  leftPanel: { padding: 24, borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" },
  rightPanel: { padding: 24, overflowY: "auto" },
  panelTitle: { fontSize: 15, fontWeight: 600, color: "#334155", marginBottom: 16 },
  pdfFrame: { flex: 1, width: "100%", border: "none", borderRadius: 8, background: "#fff" },
  actionBox: { background: "#1e293b", borderRadius: 12, padding: 20, marginTop: 8, marginBottom: 24 },
  actionTitle: { color: "#f8fafc", fontSize: 15, marginBottom: 16, marginTop: 0 },
  actionGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  actionLabel: { fontSize: 11, color: "#94a3b8", textTransform: "uppercase" },
  stepsList: { color: "#cbd5e1", fontSize: 14, lineHeight: 1.8, paddingLeft: 20 },
  buttons: { display: "flex", gap: 12, marginTop: 8 },
  approveBtn: { flex: 1, background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "14px 0", cursor: "pointer", fontSize: 15, fontWeight: 600 },
  rejectBtn: { flex: 1, background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 8, padding: "14px 0", cursor: "pointer", fontSize: 15 },
  rejectBox: { marginTop: 16 },
  rejectInput: { width: "100%", minHeight: 80, border: "1px solid #fca5a5", borderRadius: 8, padding: 12, fontSize: 14, resize: "vertical", marginBottom: 8 },
  confirmReject: { background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 14 },
};