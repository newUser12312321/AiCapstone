package com.inspection.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class DefectCountDto {
    private String label;
    private long count;
}
