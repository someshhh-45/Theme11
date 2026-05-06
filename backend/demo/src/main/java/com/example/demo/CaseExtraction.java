package com.example.demo;

import jakarta.persistence.*;

@Entity
@Table(name = "case_extractions")
public class CaseExtraction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 🔥 Relation (no caseId field anymore)
    @ManyToOne
    @JoinColumn(name = "case_id", nullable = false)
    private Case caseEntity;

    private String caseNumber;
    private String caseTitle;
    private String dateOfOrder;

    @Column(columnDefinition = "TEXT")
    private String partiesInvolved;

    @Column(columnDefinition = "TEXT")
    private String keyDirections;

    @Column(columnDefinition = "TEXT")
    private String complianceRequirements;

    private String appealConsideration;
    private String timelines;
    private String responsibleDepartments;

    private Double confidenceScore;

    // getters/setters
    public Long getId() { return id; }

    public Case getCaseEntity() { return caseEntity; }
    public void setCaseEntity(Case caseEntity) { this.caseEntity = caseEntity; }

    public String getCaseNumber() { return caseNumber; }
    public void setCaseNumber(String caseNumber) { this.caseNumber = caseNumber; }

    public String getCaseTitle() { return caseTitle; }
    public void setCaseTitle(String caseTitle) { this.caseTitle = caseTitle; }

    public String getDateOfOrder() { return dateOfOrder; }
    public void setDateOfOrder(String dateOfOrder) { this.dateOfOrder = dateOfOrder; }

    public String getPartiesInvolved() { return partiesInvolved; }
    public void setPartiesInvolved(String partiesInvolved) { this.partiesInvolved = partiesInvolved; }

    public String getKeyDirections() { return keyDirections; }
    public void setKeyDirections(String keyDirections) { this.keyDirections = keyDirections; }

    public String getComplianceRequirements() { return complianceRequirements; }
    public void setComplianceRequirements(String complianceRequirements) { this.complianceRequirements = complianceRequirements; }

    public String getAppealConsideration() { return appealConsideration; }
    public void setAppealConsideration(String appealConsideration) { this.appealConsideration = appealConsideration; }

    public String getTimelines() { return timelines; }
    public void setTimelines(String timelines) { this.timelines = timelines; }

    public String getResponsibleDepartments() { return responsibleDepartments; }
    public void setResponsibleDepartments(String responsibleDepartments) { this.responsibleDepartments = responsibleDepartments; }

    public Double getConfidenceScore() { return confidenceScore; }
    public void setConfidenceScore(Double confidenceScore) { this.confidenceScore = confidenceScore; }
}