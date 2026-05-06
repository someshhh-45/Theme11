package com.example.demo;

import jakarta.persistence.*;

@Entity
@Table(name = "cases")
public class Case {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String caseNumber;

    // 🔥 Store only absolute normalized path
    @Column(nullable = false, columnDefinition = "TEXT")
    private String pdfPath;

    @Column(nullable = false)
    private String status;

    // =========================
    // GETTERS & SETTERS
    // =========================

    public Long getId() {
        return id;
    }

    public String getCaseNumber() {
        return caseNumber;
    }

    public void setCaseNumber(String caseNumber) {
        this.caseNumber = caseNumber;
    }

    public String getPdfPath() {
        return pdfPath;
    }

    public void setPdfPath(String pdfPath) {
        // 🔥 Always normalize before storing (extra safety)
        if (pdfPath != null) {
            this.pdfPath = java.nio.file.Paths.get(pdfPath)
                    .toAbsolutePath()
                    .normalize()
                    .toString();
        } else {
            this.pdfPath = null;
        }
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}