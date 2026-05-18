package com.inspection.controller;

import com.inspection.dto.*;
import com.inspection.service.InspectionQueryService;
import com.inspection.service.InspectionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 검사 이력 REST API 컨트롤러
 *
 * <p>Base URL: /api/inspections
 *
 * <p>엔드포인트 목록:
 * - POST   /api/inspections          → 엣지 디바이스 검사 결과 수신
 * - GET    /api/inspections          → 전체 이력 조회 (프론트엔드)
 * - GET    /api/inspections/{id}     → 단건 상세 조회
 * - GET    /api/inspections/recent   → 최근 N건 조회
 * - GET    /api/inspections/stats    → 통계 요약
 * - GET    /api/inspections/period   → 기간 필터 조회
 * - DELETE /api/inspections          → 전체 이력 삭제 (대시보드)
 *
 * CORS 는 {@link com.inspection.config.GlobalCorsConfig} 에서 처리한다 (공인 IP·DELETE 등).
 */
@RestController
@RequestMapping({"/api/inspections", "/api/v1/inspections"})
@Slf4j
@RequiredArgsConstructor
public class InspectionController {

    private final InspectionService inspectionService;
    private final InspectionQueryService inspectionQueryService;

    @Value("${app.inspection-image-dir:inspection-images}")
    private String inspectionImageDir;

    // ========================================================================
    // 1. 검사 결과 수신 (라즈베리파이 → 서버)
    // ========================================================================

    /**
     * [엣지 디바이스 전용] 검사 결과 JSON 수신 및 DB 저장
     *
     * <p>POST /api/inspections
     *
     * <p>@Valid: InspectionRequestDto의 Bean Validation 어노테이션을 실행.
     *           유효성 검사 실패 시 400 Bad Request 자동 반환.
     *
     * @param requestDto 엣지 디바이스가 전송한 검사 결과 JSON
     * @return 201 Created + 저장된 검사 이력 DTO
     */
    @PostMapping
    public ResponseEntity<InspectionResponseDto> receiveInspectionResult(
            @Valid @RequestBody InspectionRequestDto requestDto) {

        log.info("[POST /api/inspections] 수신 - 디바이스: {}, 결과: {}",
                requestDto.getDeviceId(), requestDto.getResult());

        InspectionResponseDto response = inspectionService.saveInspectionResult(requestDto);

        // 201 Created + Location 헤더 없이 단순 응답 (엣지 디바이스는 Location 불필요)
        return ResponseEntity.status(201).body(response);
    }

    // ========================================================================
    // 2. 이력 조회 (프론트엔드 → 서버)
    // ========================================================================

    /**
     * 전체 검사 이력 목록 조회
     *
     * <p>GET /api/inspections
     *
     * @return 200 OK + 검사 이력 목록
     */
    @GetMapping
    public ResponseEntity<List<InspectionResponseDto>> getAllInspections() {
        log.debug("[GET /api/inspections] 전체 이력 조회");
        return ResponseEntity.ok(inspectionService.getAllInspections());
    }

    @GetMapping("/search")
    public ResponseEntity<InspectionPageResponseDto> searchInspections(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "50") @Min(1) int size,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String board,
            @RequestParam(required = false) String shift,
            @RequestParam(required = false) String defectType,
            @RequestParam(required = false) String reviewStatus) {
        var criteria = InspectionQueryService.buildCriteria(
                from, to, deviceId, result, board, shift, defectType, reviewStatus);
        return ResponseEntity.ok(inspectionQueryService.search(criteria, page, size));
    }

    @GetMapping("/facets")
    public ResponseEntity<InspectionFacetsDto> getFacets() {
        return ResponseEntity.ok(inspectionQueryService.getFacets());
    }

    @GetMapping("/line-status")
    public ResponseEntity<InspectionLineStatusDto> getLineStatus(
            @RequestParam(required = false) String deviceId) {
        return ResponseEntity.ok(inspectionQueryService.getLineStatus(deviceId));
    }

    @GetMapping("/summary/daily")
    public ResponseEntity<List<com.inspection.dto.DailyVolumeDto>> getDailySummary(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String board,
            @RequestParam(required = false) String shift) {
        var criteria = InspectionQueryService.buildCriteria(
                from, to, deviceId, null, board, shift, null, null);
        return ResponseEntity.ok(inspectionQueryService.getDailyVolume(criteria));
    }

    @GetMapping("/summary/hourly")
    public ResponseEntity<List<HourlyVolumeDto>> getHourlySummary(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String board,
            @RequestParam(required = false) String shift) {
        var criteria = InspectionQueryService.buildCriteria(
                from, to, deviceId, null, board, shift, null, null);
        return ResponseEntity.ok(inspectionQueryService.getHourlyVolume(criteria));
    }

    @GetMapping("/summary/defects")
    public ResponseEntity<List<DefectCountDto>> getDefectSummary(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String board,
            @RequestParam(required = false) String shift,
            @RequestParam(required = false) String defectType,
            @RequestParam(defaultValue = "6") @Min(1) int limit) {
        var criteria = InspectionQueryService.buildCriteria(
                from, to, deviceId, "FAIL", board, shift, defectType, null);
        return ResponseEntity.ok(inspectionQueryService.getDefectSummary(criteria, limit));
    }

    /**
     * 단건 검사 이력 상세 조회
     *
     * <p>GET /api/inspections/{id}
     *
     * @param id 검사 로그 ID (PathVariable)
     * @return 200 OK + 검사 상세 DTO / 404 Not Found
     */
    @GetMapping("/{id}")
    public ResponseEntity<InspectionResponseDto> getInspectionById(
            @PathVariable Long id) {
        log.debug("[GET /api/inspections/{}] 단건 조회", id);
        return ResponseEntity.ok(inspectionService.getInspectionById(id));
    }

    /**
     * 최근 N건 검사 이력 조회 (대시보드 실시간 피드)
     *
     * <p>GET /api/inspections/recent?limit=10
     *
     * @param limit 조회 건수 (기본값: 10, 최솟값: 1)
     * @return 200 OK + 최근 N건 이력 목록
     */
    @GetMapping("/recent")
    public ResponseEntity<List<InspectionResponseDto>> getRecentInspections(
            @RequestParam(defaultValue = "10") @Min(1) int limit) {
        log.debug("[GET /api/inspections/recent] 최근 {}건 조회", limit);
        return ResponseEntity.ok(inspectionService.getRecentInspections(limit));
    }

    /**
     * 전체 통계 요약 조회 (대시보드 StatCard)
     *
     * <p>GET /api/inspections/stats
     *
     * <p>응답 예시:
     * {
     *   "totalCount": 350,
     *   "passCount": 320,
     *   "failCount": 30,
     *   "failRate": 8.57
     * }
     *
     * @return 200 OK + 통계 집계 Map
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStatsSummary(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String board,
            @RequestParam(required = false) String shift) {
        if (from == null && to == null && deviceId == null && result == null && board == null && shift == null) {
            return ResponseEntity.ok(inspectionService.getStatsSummary());
        }
        var criteria = InspectionQueryService.buildCriteria(
                from, to, deviceId, result, board, shift, null, null);
        return ResponseEntity.ok(inspectionQueryService.getStatsSummary(criteria));
    }

    @PatchMapping("/{id}/review")
    public ResponseEntity<InspectionResponseDto> updateReview(
            @PathVariable Long id,
            @Valid @RequestBody InspectionReviewRequestDto body) {
        return ResponseEntity.ok(inspectionQueryService.updateReview(id, body.getReviewStatus()));
    }

    /**
     * 기간 필터 검사 이력 조회
     *
     * <p>GET /api/inspections/period?from=2026-03-01T00:00:00&to=2026-03-31T23:59:59
     *
     * @param from 시작 시각 (ISO 형식)
     * @param to   종료 시각 (ISO 형식)
     * @return 200 OK + 해당 기간 검사 이력 목록
     */
    @GetMapping("/period")
    public ResponseEntity<List<InspectionResponseDto>> getInspectionsByPeriod(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        log.debug("[GET /api/inspections/period] {} ~ {}", from, to);
        return ResponseEntity.ok(inspectionService.getInspectionsByPeriod(from, to));
    }

    /**
     * 전체 검사 이력 및 결함 상세 삭제 (운영자 대시보드 초기화).
     *
     * <p>DELETE /api/inspections
     */
    @DeleteMapping
    public ResponseEntity<Void> deleteAllInspections() {
        log.warn("[DELETE /api/inspections] 전체 이력 삭제 요청");
        inspectionService.deleteAllInspections();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/images/{filename:.+}")
    public ResponseEntity<Resource> getInspectionImage(@PathVariable String filename) {
        try {
            Path root = Paths.get(inspectionImageDir).toAbsolutePath().normalize();
            Path target = root.resolve(filename).normalize();
            if (!target.startsWith(root) || !Files.exists(target)) {
                return ResponseEntity.notFound().build();
            }

            Resource resource = new UrlResource(target.toUri());
            String mimeType = Files.probeContentType(target);
            MediaType mediaType = (mimeType == null)
                    ? MediaType.APPLICATION_OCTET_STREAM
                    : MediaType.parseMediaType(mimeType);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                    .contentType(mediaType)
                    .body(resource);
        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
