package com.inspection.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class InspectionLineStatusDto {
    private String deviceId;
    private LocalDateTime lastInspectedAt;
    private String lastResult;
    private Long lastInspectionId;
    private LocalDateTime lastFailAt;
    private Long lastFailId;
    /** 마지막 검사 후 경과 초 (클라이언트 시계 기준 서버 now) */
    private long secondsSinceLastInspection;
    private boolean stale;
}
