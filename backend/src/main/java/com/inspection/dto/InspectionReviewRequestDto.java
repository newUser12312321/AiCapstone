package com.inspection.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class InspectionReviewRequestDto {
    @NotBlank
    private String reviewStatus;
}
