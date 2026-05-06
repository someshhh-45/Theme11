import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { uploadPDF, extractCase } from "../api/client";

const STAGES = [
  "PDF Parsed",
  "AI Extracting",
  "Action Plan Generated",
  "Ready for Review",
];

export default function UploadPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle"); // idle | uploading | processing | error
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");

  const processFile = async (file) => {
    if (file.size > 20 * 1024 * 1024) {
      setError("File too large. Maximum size is 20MB.");
      return;
    }

    try {
      setStatus("uploading");
      setError("");

      // Step 1: Upload
      const { data: uploadData } = await uploadPDF(file);
      const caseId = uploadData.case_id;

      // Step 2: Trigger extraction pipeline
      setStatus("processing");
      setStage(0);

      // Simulate stage progression while extraction runs
      const stageInterval = setInterval(() => {
        setStage((s) => (s < STAGES.length - 2 ? s + 1 : s));
      }, 1500);

      await extractCase(caseId);
      clearInterval(stageInterval);
      setStage(STAGES.length - 1);

      // Redirect to review
      setTimeout(() => navigate(`/review/${caseId}`), 800);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed. Please try again.");
      setStatus("error");
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) processFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: status === "uploading" || status === "processing",
  });

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Court Order Extractor</h1>
        <a href="/dashboard" style={styles.dashLink}>→ Dashboard</a>
      </header>

      <main style={styles.main}>
        <h2 style={styles.heading}>Upload Judgment PDF</h2>
        <p style={styles.sub}>Supports digital and scanned PDFs. Max 20MB.</p>

        {status === "idle" || status === "error" ? (
          <>
            <div
              {...getRootProps()}
              style={{
                ...styles.dropzone,
                borderColor: isDragActive ? "#2563eb" : "#cbd5e1",
                background: isDragActive ? "#eff6ff" : "#f8fafc",
              }}
            >
              <input {...getInputProps()} />
              <div style={styles.dropIcon}>📄</div>
              <p style={styles.dropText}>
                {isDragActive
                  ? "Drop it here..."
                  : "Drag & drop a PDF, or click to browse"}
              </p>
              <span style={styles.dropHint}>PDF files only</span>
            </div>
            {error && <p style={styles.error}>{error}</p>}
          </>
        ) : (
          <div style={styles.pipelineBox}>
            <p style={styles.processingTitle}>
              {status === "uploading" ? "Uploading..." : "Processing..."}
            </p>
            <div style={styles.stages}>
              {STAGES.map((label, i) => (
                <div key={i} style={styles.stageRow}>
                  <div
                    style={{
                      ...styles.stageIndicator,
                      background:
                        i < stage ? "#16a34a"
                        : i === stage ? "#2563eb"
                        : "#e2e8f0",
                    }}
                  >
                    {i < stage ? "✓" : i === stage ? "⟳" : ""}
                  </div>
                  <span
                    style={{
                      ...styles.stageLabel,
                      color: i <= stage ? "#1e293b" : "#94a3b8",
                      fontWeight: i === stage ? 600 : 400,
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f1f5f9", fontFamily: "Georgia, serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 40px", background: "#1e293b" },
  title: { color: "#f8fafc", fontSize: 20, margin: 0 },
  dashLink: { color: "#94a3b8", textDecoration: "none", fontSize: 14 },
  main: { maxWidth: 560, margin: "80px auto", padding: "0 24px" },
  heading: { fontSize: 28, color: "#1e293b", marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 32, fontSize: 15 },
  dropzone: { border: "2px dashed", borderRadius: 12, padding: "60px 40px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" },
  dropIcon: { fontSize: 48, marginBottom: 16 },
  dropText: { fontSize: 16, color: "#334155", marginBottom: 8 },
  dropHint: { fontSize: 13, color: "#94a3b8" },
  error: { color: "#dc2626", marginTop: 16, fontSize: 14, textAlign: "center" },
  pipelineBox: { background: "#fff", borderRadius: 12, padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  processingTitle: { fontSize: 18, fontWeight: 600, color: "#1e293b", marginBottom: 28 },
  stages: { display: "flex", flexDirection: "column", gap: 16 },
  stageRow: { display: "flex", alignItems: "center", gap: 16 },
  stageIndicator: { width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", flexShrink: 0 },
  stageLabel: { fontSize: 15 },
};