package com.inspection.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class HourlyVolumeDto {
    private long bucketStartMs;
    private String label;
    private int hour;
    private String anchorDate;
    private int pass;
    private int fail;
    private int count;
}
