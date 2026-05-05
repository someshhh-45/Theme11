package com.example.demo;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CaseExtractionRepository extends JpaRepository<CaseExtraction, Long> {

    // 🔥 matches caseEntity.id
    Optional<CaseExtraction> findByCaseEntity_Id(Long caseId);
}