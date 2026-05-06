package com.example.demo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.reactive.function.BodyInserters;

import java.io.File;

@Service
public class AiService {

    private final WebClient webClient = WebClient.builder()
            .baseUrl("http://localhost:5000")
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    // =========================
    // 🔥 SEND FILE (FIXED)
    // =========================
    public String extractFromFile(File file) {
        try {
            MultipartBodyBuilder builder = new MultipartBodyBuilder();

            builder.part("file", new FileSystemResource(file));

            return webClient.post()
                    .uri("/extract")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(builder.build()))
                    .retrieve()
                    .onStatus(status -> status.isError(), response ->
                            response.bodyToMono(String.class)
                                    .map(body -> new RuntimeException(
                                            "Flask Error: " + response.statusCode() + " → " + body
                                    ))
                    )
                    .bodyToMono(String.class)
                    .block();

        } catch (WebClientResponseException e) {
            throw new RuntimeException("Flask API failed: " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw new RuntimeException("AI service error: " + e.getMessage(), e);
        }
    }

    // =========================
    // ❌ OLD METHOD (REMOVE OR IGNORE)
    // =========================
    public String extract(String filePath) {
        throw new RuntimeException("Deprecated: use extractFromFile(File file)");
    }

    // =========================
    // 🔹 JSON PARSER
    // =========================
    public JsonNode parseJson(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException("JSON parsing failed. Raw response: " + json, e);
        }
    }
}