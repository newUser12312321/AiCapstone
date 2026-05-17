package com.inspection.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
@AllArgsConstructor
public class InspectionPageResponseDto {
    private List<InspectionResponseDto> content;
    private long totalElements;
    private int totalPages;
    private int page;
    private int size;
}
