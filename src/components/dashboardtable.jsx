import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboard } from "../api/client";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [filters, setFilters] = useState({ department: "", action_type: "" });
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getDashboard(filters)
      .then((r) => { setCases(r.data.cases || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const stats = {
    total: cases.length,
    pending: cases.filter((c) => c.action_type === "comply").length,
    appeal: cases.filter((c) => c.action_type === "appeal").length,
    overdue: cases.filter((c) => c.is_overdue).length,
  };

  const exportCSV = () => {
    const headers = ["Case Number", "Title", "Date", "Department", "Action", "Deadline", "Status"];
    const rows = cases.map((c) => [c.case_number, c.case_title, c.date_of_order, c.department, c.action_type, c.deadline, c.status]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "cases.csv"; a.click();
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Court Order Dashboard</h1>
        <a href="/upload" style={styles.uploadLink}>+ Upload New</a>
      </header>

      {/* Summary Cards */}
      <div style={styles.cards}>
        {[
          { label: "Total Verified", value: stats.total, color: "#2563eb" },
          { label: "Comply Actions", value: stats.pending, color: "#16a34a" },
          { label: "Appeal Actions", value: stats.appeal, color: "#d97706" },
          { label: "Overdue", value: stats.overdue, color: "#dc2626" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
            <div style={{ fontSize: 32, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters + Export */}
      <div style={styles.toolbar}>
        <select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })} style={styles.select}>
          <option value="">All Departments</option>
          <option value="legal">Legal</option>
          <option value="finance">Finance</option>
          <option value="hr">HR</option>
          <option value="operations">Operations</option>
        </select>
        <select value={filters.action_type} onChange={(e) => setFilters({ ...filters, action_type: e.target.value })} style={styles.select}>
          <option value="">All Actions</option>
          <option value="comply">Comply</option>
          <option value="appeal">Appeal</option>
        </select>
        <button onClick={exportCSV} style={styles.exportBtn}>↓ Export CSV</button>
      </div>

      {/* Cases Table */}
      <div style={styles.tableWrap}>
        {loading ? (
          <p style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading...</p>
        ) : cases.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No verified cases yet. <a href="/upload">Upload one →</a></p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                {["Case Number", "Title", "Date", "Department", "Action", "Deadline", "Status"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.case_id} onClick={() => navigate(`/review/${c.case_id}`)} style={styles.row}>
                  <td style={styles.td}><strong>{c.case_number}</strong></td>
                  <td style={styles.td}>{c.case_title}</td>
                  <td style={styles.td}>{c.date_of_order}</td>
                  <td style={styles.td}>{c.department}</td>
                  <td style={styles.td}>
                    <span style={{ background: c.action_type === "appeal" ? "#fffbeb" : "#f0fdf4", color: c.action_type === "appeal" ? "#d97706" : "#16a34a", borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
                      {c.action_type}
                    </span>
                  </td>
                  <td style={{ ...styles.td, color: c.is_overdue ? "#dc2626" : "#1e293b" }}>{c.deadline || "—"}</td>
                  <td style={styles.td}>
                    <span style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 6, padding: "2px 10px", fontSize: 12 }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f1f5f9", fontFamily: "Georgia, serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 40px", background: "#1e293b" },
  title: { color: "#f8fafc", fontSize: 20, margin: 0 },
  uploadLink: { background: "#2563eb", color: "#fff", padding: "8px 20px", borderRadius: 8, textDecoration: "none", fontSize: 14 },
  cards: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "32px 40px 0" },
  card: { background: "#fff", borderRadius: 10, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  toolbar: { display: "flex", gap: 12, padding: "20px 40px", alignItems: "center" },
  select: { padding: "8px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, background: "#fff", color: "#334155" },
  exportBtn: { marginLeft: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 14, color: "#334155" },
  tableWrap: { margin: "0 40px 40px", background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: { background: "#f8fafc" },
  th: { padding: "14px 16px", textAlign: "left", fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e2e8f0" },
  row: { cursor: "pointer", transition: "background 0.15s" },
  td: { padding: "14px 16px", fontSize: 14, color: "#1e293b", borderBottom: "1px solid #f1f5f9" },
};