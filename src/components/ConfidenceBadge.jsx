export default function ConfidenceBadge({ score }) {
  const color = score >= 85 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
  const bg = score >= 85 ? "#f0fdf4" : score >= 60 ? "#fffbeb" : "#fef2f2";
  const label = score >= 85 ? "High" : score >= 60 ? "Medium" : "Low";
  return (
    <span style={{ background: bg, color, border: `1px solid ${color}30`, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
      {label} {score}%
    </span>
  );
}