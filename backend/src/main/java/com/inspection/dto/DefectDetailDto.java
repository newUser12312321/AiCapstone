package com.inspection.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

/**
 * 결함 상세 정보 DTO (요청/응답 공용)
 *
 * <p>라즈베리파이가 전송하는 JSON 배열의 각 요소와 매핑된다.
 * 예시 JSON:
 * {
 *   "defectType": "TRACE_OPEN",
 *   "confidence": 0.87,
 *   "bboxX": 430.25, "bboxY": 210.5,
 *   "bboxWidth": 55.0, "bboxHeight": 30.0
 * }
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DefectDetailDto {

    /** 결함 종류 (TRACE_OPEN / METAL_DAMAGE / FIDUCIAL_MISSING) */
    @NotBlank(message = "결함 종류는 필수입니다.")
    private String defectType;

    /** YOLO 신뢰도 (0.0 ~ 1.0) */
    @NotNull
    @DecimalMin("0.0") @DecimalMax("1.0")
    private Float confidence;

    /** 바운딩 박스 좌상단 X (픽셀, 서브픽셀 가능) */
    @NotNull
    @DecimalMin(value = "0.0", inclusive = true)
    private Double bboxX;

    /** 바운딩 박스 좌상단 Y (픽셀, 서브픽셀 가능) */
    @NotNull
    @DecimalMin(value = "0.0", inclusive = true)
    private Double bboxY;

    /** 바운딩 박스 너비 (픽셀) */
    @NotNull
    @Positive
    private Double bboxWidth;

    /** 바운딩 박스 높이 (픽셀) */
    @NotNull
    @Positive
    private Double bboxHeight;

    /** 실크 검증 등 한글 부가 메시지 (선택, 엣지 → 서버 저장) */
    private String detail;
}
