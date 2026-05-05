package com.example.demo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.file.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/cases")
@CrossOrigin(origins = "*")
public class CaseController {

    @Autowired
    private CaseRepository repo;

    @Autowired
    private CaseExtractionRepository extractionRepo;

    @Autowired
    private AiService aiService;

    // =========================
    // 1) UPLOAD
    // =========================
    @PostMapping("/upload")
    public Case uploadCase(@RequestParam("file") MultipartFile file) {
        try {
            Path uploadPath = Paths.get(
                    System.getProperty("user.dir"),
                    "..",
                    "ai_service",
                    "uploads"
            ).toAbsolutePath().normalize();

            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            String fileName = System.currentTimeMillis() + "_" + file.getOriginalFilename();
            Path filePath = uploadPath.resolve(fileName).toAbsolutePath().normalize();

            Files.write(filePath, file.getBytes());

            Case c = new Case();
            c.setCaseNumber("AUTO-" + System.currentTimeMillis());
            c.setPdfPath(filePath.toString());
            c.setStatus("uploaded");

            return repo.save(c);

        } catch (Exception e) {
            throw new RuntimeException("File upload failed: " + e.getMessage());
        }
    }

    // =========================
    // 2) GET ALL
    // =========================
    @GetMapping("/all")
    public List<Case> getAllCases() {
        return repo.findAll();
    }

    // =========================
    // 3) PROCESS (AI)
    // =========================
    @GetMapping("/process/{id}")
    public ResponseEntity<?> processCase(@PathVariable Long id) {

        Case c = repo.findById(id).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();

        try {
            Path path = Paths.get(c.getPdfPath()).toAbsolutePath().normalize();

            if (!Files.exists(path)) {
                return ResponseEntity.status(400).body(Map.of(
                        "error", "File not found",
                        "path", path.toString()
                ));
            }

            // 🔥 SEND FILE TO FLASK
            File file = path.toFile();
            String rawJson = aiService.extractFromFile(file);

            var node = aiService.parseJson(rawJson);

            com.fasterxml.jackson.databind.JsonNode dataNode = node;

            var resultsNode = node.get("results");
            if (resultsNode != null && resultsNode.isArray() && resultsNode.size() > 0) {
                var first = resultsNode.get(0);
                if (first != null) {
                    var firstData = first.get("data");
                    if (firstData != null && firstData.isObject()) {
                        dataNode = firstData;
                    } else {
                        dataNode = first;
                    }
                }
            }

            if (dataNode.has("error")) {
                return ResponseEntity.status(502).body(Map.of(
                        "error", "AI extraction failed",
                        "detail", getField(dataNode, "error")
                ));
            }

            // 🔥 UPSERT EXTRACTION
            CaseExtraction ext = extractionRepo.findByCaseEntity_Id(id).orElseGet(CaseExtraction::new);
            ext.setCaseEntity(c);

            ext.setCaseNumber(getFieldAny(dataNode, "caseNumber", "case_number"));
            ext.setCaseTitle(getFieldAny(dataNode, "caseTitle", "case_title"));
            ext.setDateOfOrder(getFieldAny(dataNode, "dateOfOrder", "date_of_order"));
            ext.setPartiesInvolved(getFieldAny(dataNode, "partiesInvolved", "parties_involved", "parties"));
            ext.setKeyDirections(getFieldAny(dataNode, "keyDirections", "key_directions"));
            ext.setComplianceRequirements(getFieldAny(dataNode, "complianceRequirements", "compliance_requirements"));
            ext.setAppealConsideration(getFieldAny(dataNode, "appealConsideration", "appeal_consideration"));
            ext.setTimelines(getFieldAny(dataNode, "timelines"));
            ext.setResponsibleDepartments(getFieldAny(dataNode, "responsibleDepartments", "responsible_departments"));

            // 🔥 CONFIDENCE
            ext.setConfidenceScore(getOverallConfidence(dataNode));

            extractionRepo.save(ext);

            // =========================
            // 🔥 AUTO STATUS (NEW)
            // =========================
            Double confidence = ext.getConfidenceScore();

            String status;

            if (confidence == null) {
                status = "pending_review";
            } else if (confidence >= 0.85) {
                status = "verified";
            } else if (confidence >= 0.6) {
                status = "pending_review";
            } else {
                status = "low_confidence";
            }

            System.out.println("Confidence: " + confidence + " → Status: " + status);

            c.setStatus(status);
            repo.save(c);

            return ResponseEntity.ok(Map.of(
                    "message", "AI processing completed",
                    "caseId", id,
                    "confidence", confidence,
                    "status", status
            ));

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", "AI processing failed",
                    "detail", e.getMessage()
            ));
        }
    }

    // =========================
    // 4) REVIEW
    // =========================
    @PostMapping("/review/{id}")
    public ResponseEntity<?> reviewCase(
            @PathVariable Long id,
            @RequestParam String decision) {

        Case c = repo.findById(id).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();

        String status = decision.equalsIgnoreCase("approve") ? "verified" : "rejected";
        c.setStatus(status);
        repo.save(c);

        return ResponseEntity.ok(Map.of(
                "message", "Case " + status,
                "caseId", id,
                "status", status
        ));
    }

    // =========================
    // 5) GET EXTRACTION
    // =========================
    @GetMapping("/{id}/extraction")
    public ResponseEntity<?> getExtraction(@PathVariable Long id) {
        return extractionRepo.findByCaseEntity_Id(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(404).body(Map.of(
                        "error", "No extraction found. Run /process first."
                )));
    }

    // =========================
    // 6) GET PDF
    // =========================
    @GetMapping("/{id}/pdf")
    public ResponseEntity<Resource> getPdf(@PathVariable Long id) {

        Case c = repo.findById(id).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();

        try {
            Path path = Paths.get(c.getPdfPath()).toAbsolutePath().normalize();

            if (!Files.exists(path)) return ResponseEntity.notFound().build();

            Resource res = new FileSystemResource(path);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=\"" + path.getFileName() + "\"")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(res);

        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    // =========================
    // 🔹 HELPERS
    // =========================
    private String getField(com.fasterxml.jackson.databind.JsonNode node, String field) {
        var n = node.get(field);
        if (n == null || n.isNull()) return "";
        if (n.isArray() || n.isObject()) return n.toString();
        return n.asText();
    }

    private String getFieldAny(com.fasterxml.jackson.databind.JsonNode node, String... fields) {
        for (String f : fields) {
            String val = getField(node, f);
            if (val != null && !val.isBlank()) return val;
        }
        return "";
    }

    private Double getOverallConfidence(com.fasterxml.jackson.databind.JsonNode node) {
        var val = node.get("confidence_overall");
        if (val == null || val.isNull()) return null;
        return val.asDouble();
    }
}