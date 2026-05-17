package com.inspection.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
@AllArgsConstructor
public class InspectionFacetsDto {
    private List<String> deviceIds;
    private List<String> boardNames;
}
