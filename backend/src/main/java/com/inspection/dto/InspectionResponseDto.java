package com.inspection.dto;

import com.inspection.domain.entity.DefectDetail;
import com.inspection.domain.entity.InspectionLog;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Spring Boot → React 프론트엔드로 반환하는 검사 결과 응답 DTO
 *
 * <p>엔티티(InspectionLog)를 직접 노출하지 않고 DTO로 변환하여
 * API 응답 형태를 JPA 구조와 분리한다.
 *
 * <p>정적 팩토리 메서드 from()으로 엔티티 → DTO 변환을 캡슐화한다.
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InspectionResponseDto {

    /** 검사 로그 고유 ID */
    private Long id;

    /** 검사 수행 디바이스 ID */
    private String deviceId;

    /** 최종 판정 결과 ("PASS" / "FAIL") */
    private String result;

    // ── 피듀셜 마크 좌표 ─────────────────────────────────────────────────────
    private Double fiducial1X;
    private Double fiducial1Y;
    private Double fiducial2X;
    private Double fiducial2Y;

    private Double fiducial1XRaw;
    private Double fiducial1YRaw;
    private Double fiducial2XRaw;
    private Double fiducial2YRaw;

    private Double fiducial1XYolo;
    private Double fiducial1YYolo;
    private Double fiducial2XYolo;
    private Double fiducial2YYolo;

    private Float fiducial1Confidence;
    private Float fiducial2Confidence;

    /** 정렬 오차 각도 (°) */
    private Float angleErrorDeg;

    /** YOLO 추론 시간 (ms) */
    private Integer inferenceTimeMs;

    /** 총 처리 시간 (ms) */
    private Integer totalTimeMs;

    /** 캡처 이미지 경로 */
    private String imagePath;

    /** 검사 수행 시각 */
    private LocalDateTime inspectedAt;

    /** 서버 레코드 생성 시각 */
    private LocalDateTime createdAt;

    /** 탐지된 결함 목록 */
    private List<DefectDetailDto> defects;

    /** 실크 OCR — 시리즈명 */
    private String silkSeriesName;
    /** 실크 OCR — 기판명 */
    private String silkBoardName;
    /** 실크 OCR — 제조회사 */
    private String silkManufacturer;
    /** 실크 OCR — 제조일자 문자열 */
    private String silkManufactureDate;

    /** FAIL 리뷰 상태 (PENDING | CONFIRMED | FALSE_CALL, null=PENDING) */
    private String reviewStatus;

    private LocalDateTime reviewedAt;

    // ── 정적 팩토리 메서드 ────────────────────────────────────────────────────

    /**
     * InspectionLog 엔티티를 InspectionResponseDto로 변환한다.
     *
     * <p>서비스/컨트롤러 레이어에서 엔티티를 응답 DTO로 변환할 때 사용.
     * 엔티티 구조가 바뀌어도 이 메서드만 수정하면 된다.
     *
     * @param log 변환할 InspectionLog 엔티티
     * @return 프론트엔드 전송용 DTO
     */
    public static InspectionResponseDto from(InspectionLog log) {
        // DefectDetail 엔티티 목록 → DefectDetailDto 목록으로 변환
        List<DefectDetailDto> defectDtos = log.getDefects().stream()
                .map(InspectionResponseDto::toDefectDto)
                .collect(Collectors.toList());

        return InspectionResponseDto.builder()
                .id(log.getId())
                .deviceId(log.getDeviceId())
                .result(log.getResult().name())
                .fiducial1X(log.getFiducial1X())
                .fiducial1Y(log.getFiducial1Y())
                .fiducial2X(log.getFiducial2X())
                .fiducial2Y(log.getFiducial2Y())
                .fiducial1XRaw(log.getFiducial1XRaw())
                .fiducial1YRaw(log.getFiducial1YRaw())
                .fiducial2XRaw(log.getFiducial2XRaw())
                .fiducial2YRaw(log.getFiducial2YRaw())
                .fiducial1XYolo(log.getFiducial1XYolo())
                .fiducial1YYolo(log.getFiducial1YYolo())
                .fiducial2XYolo(log.getFiducial2XYolo())
                .fiducial2YYolo(log.getFiducial2YYolo())
                .fiducial1Confidence(log.getFiducial1Confidence())
                .fiducial2Confidence(log.getFiducial2Confidence())
                .angleErrorDeg(log.getAngleErrorDeg())
                .inferenceTimeMs(log.getInferenceTimeMs())
                .totalTimeMs(log.getTotalTimeMs())
                .imagePath(log.getImagePath())
                .inspectedAt(log.getInspectedAt())
                .createdAt(log.getCreatedAt())
                .defects(defectDtos)
                .silkSeriesName(log.getSilkSeriesName())
                .silkBoardName(log.getSilkBoardName())
                .silkManufacturer(log.getSilkManufacturer())
                .silkManufactureDate(log.getSilkManufactureDate())
                .reviewStatus(log.getReviewStatus() != null ? log.getReviewStatus().name() : null)
                .reviewedAt(log.getReviewedAt())
                .build();
    }

    /** DefectDetail 엔티티 → DefectDetailDto 변환 내부 헬퍼 */
    private static DefectDetailDto toDefectDto(DefectDetail d) {
        return DefectDetailDto.builder()
                .defectType(d.getDefectType())
                .confidence(d.getConfidence())
                .bboxX(d.getBboxX())
                .bboxY(d.getBboxY())
                .bboxWidth(d.getBboxWidth())
                .bboxHeight(d.getBboxHeight())
                .detail(d.getDetail())
                .build();
    }
}
