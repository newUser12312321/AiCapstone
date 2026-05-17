package com.inspection.dto;

import com.inspection.domain.enums.InspectionResult;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class InspectionSearchCriteria {
    private LocalDateTime from;
    private LocalDateTime to;
    private String deviceId;
    private InspectionResult result;
    private String board;
    /** DAY | SWING | NIGHT — inspectedAt 시각(로컬) 기준 */
    private String shift;
    /** defectType 부분 일치 (대시보드 집계 라벨은 프론트에서 defectType으로 매핑) */
    private String defectType;
    /** 리뷰 상태 필터 */
    private String reviewStatus;
}
