package com.inspection.service;

import com.inspection.domain.entity.DefectDetail;
import com.inspection.domain.entity.InspectionLog;
import com.inspection.domain.enums.InspectionResult;
import com.inspection.domain.enums.ReviewStatus;
import com.inspection.dto.*;
import com.inspection.repository.InspectionLogRepository;
import com.inspection.repository.InspectionSpecifications;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InspectionQueryService {

    private static final int MAX_PAGE_SIZE = 200;
    private static final long STALE_SECONDS = 300;

    private final InspectionLogRepository inspectionLogRepository;

    @Transactional(readOnly = true)
    public InspectionPageResponseDto search(InspectionSearchCriteria criteria, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        Specification<InspectionLog> spec = InspectionSpecifications.fromCriteria(criteria);
        Page<InspectionLog> result = inspectionLogRepository.findAll(
                spec,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "inspectedAt"))
        );
        List<InspectionResponseDto> content = result.getContent().stream()
                .map(InspectionResponseDto::from)
                .collect(Collectors.toList());
        return InspectionPageResponseDto.builder()
                .content(content)
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .page(safePage)
                .size(safeSize)
                .build();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStatsSummary(InspectionSearchCriteria criteria) {
        Specification<InspectionLog> base = InspectionSpecifications.fromCriteria(criteria);
        long total = inspectionLogRepository.count(base);
        long pass = inspectionLogRepository.count(base.and(
                (root, query, cb) -> cb.equal(root.get("result"), InspectionResult.PASS)));
        long fail = inspectionLogRepository.count(base.and(
                (root, query, cb) -> cb.equal(root.get("result"), InspectionResult.FAIL)));
        double failRate = total > 0 ? (double) fail / total * 100.0 : 0.0;
        return Map.of(
                "totalCount", total,
                "passCount", pass,
                "failCount", fail,
                "failRate", Math.round(failRate * 100.0) / 100.0
        );
    }

    @Transactional(readOnly = true)
    public InspectionFacetsDto getFacets() {
        return InspectionFacetsDto.builder()
                .deviceIds(inspectionLogRepository.findDistinctDeviceIds())
                .boardNames(inspectionLogRepository.findDistinctBoardNames())
                .build();
    }

    @Transactional(readOnly = true)
    public List<HourlyVolumeDto> getHourlyVolume(InspectionSearchCriteria criteria) {
        LocalDateTime to = criteria.getTo() != null ? criteria.getTo() : LocalDateTime.now();
        LocalDateTime end = to.withMinute(0).withSecond(0).withNano(0);
        LocalDateTime from = end.minusHours(23);
        InspectionSearchCriteria windowed = InspectionSearchCriteria.builder()
                .from(from)
                .to(to)
                .deviceId(criteria.getDeviceId())
                .board(criteria.getBoard())
                .shift(criteria.getShift())
                .build();
        List<InspectionLog> logs = inspectionLogRepository.findAll(
                InspectionSpecifications.fromCriteria(windowed),
                Sort.by(Sort.Direction.ASC, "inspectedAt")
        );

        Map<Long, int[]> buckets = new LinkedHashMap<>();
        LocalDateTime cursor = from;
        while (!cursor.isAfter(end)) {
            long ms = atZoneMs(cursor);
            buckets.put(ms, new int[]{0, 0});
            cursor = cursor.plusHours(1);
        }

        for (InspectionLog log : logs) {
            LocalDateTime t = log.getInspectedAt().withMinute(0).withSecond(0).withNano(0);
            long ms = atZoneMs(t);
            int[] cell = buckets.get(ms);
            if (cell == null) continue;
            if (log.getResult() == InspectionResult.PASS) cell[0]++;
            else cell[1]++;
        }

        DateTimeFormatter labelFmt = DateTimeFormatter.ofPattern("MM/dd HH:00");
        List<HourlyVolumeDto> out = new ArrayList<>();
        for (Map.Entry<Long, int[]> e : buckets.entrySet()) {
            LocalDateTime dt = LocalDateTime.ofInstant(
                    java.time.Instant.ofEpochMilli(e.getKey()),
                    java.time.ZoneId.systemDefault());
            int pass = e.getValue()[0];
            int fail = e.getValue()[1];
            out.add(new HourlyVolumeDto(
                    e.getKey(),
                    dt.format(labelFmt),
                    dt.getHour(),
                    dt.toLocalDate().toString(),
                    pass,
                    fail,
                    pass + fail
            ));
        }
        return out;
    }

    private static long atZoneMs(LocalDateTime dt) {
        return dt.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    @Transactional(readOnly = true)
    public List<DefectCountDto> getDefectSummary(InspectionSearchCriteria criteria, int limit) {
        InspectionSearchCriteria failCriteria = InspectionSearchCriteria.builder()
                .from(criteria.getFrom())
                .to(criteria.getTo())
                .deviceId(criteria.getDeviceId())
                .board(criteria.getBoard())
                .shift(criteria.getShift())
                .result(InspectionResult.FAIL)
                .defectType(criteria.getDefectType())
                .build();
        List<InspectionLog> logs = inspectionLogRepository.findAll(
                InspectionSpecifications.fromCriteria(failCriteria),
                Sort.by(Sort.Direction.DESC, "inspectedAt")
        );
        Map<String, Long> counts = new LinkedHashMap<>();
        int max = Math.min(Math.max(limit, 1), 20);
        for (InspectionLog log : logs) {
            for (DefectDetail d : log.getDefects()) {
                String key = d.getDefectType() + (d.getDetail() != null && !d.getDetail().isBlank()
                        ? "\0" + d.getDetail().trim() : "");
                counts.merge(key, 1L, Long::sum);
            }
        }
        return counts.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(max)
                .map(e -> {
                    String label = e.getKey().contains("\0")
                            ? e.getKey().substring(0, e.getKey().indexOf('\0'))
                            : e.getKey();
                    return new DefectCountDto(label, e.getValue());
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public InspectionLineStatusDto getLineStatus(String deviceId) {
        LocalDateTime now = LocalDateTime.now();
        Optional<InspectionLog> last = (deviceId != null && !deviceId.isBlank())
                ? inspectionLogRepository.findFirstByDeviceIdOrderByInspectedAtDesc(deviceId.trim())
                : inspectionLogRepository.findTopNByOrderByInspectedAtDesc(1).stream().findFirst();

        Optional<InspectionLog> lastFail = (deviceId != null && !deviceId.isBlank())
                ? inspectionLogRepository.findFirstByDeviceIdAndResultOrderByInspectedAtDesc(
                        deviceId.trim(), InspectionResult.FAIL)
                : inspectionLogRepository.findFirstByResultOrderByInspectedAtDesc(InspectionResult.FAIL);

        if (last.isEmpty()) {
            return InspectionLineStatusDto.builder()
                    .deviceId(deviceId)
                    .stale(true)
                    .secondsSinceLastInspection(-1)
                    .build();
        }
        InspectionLog l = last.get();
        long seconds = java.time.Duration.between(l.getInspectedAt(), now).getSeconds();
        InspectionLineStatusDto.InspectionLineStatusDtoBuilder b = InspectionLineStatusDto.builder()
                .deviceId(l.getDeviceId())
                .lastInspectedAt(l.getInspectedAt())
                .lastResult(l.getResult().name())
                .lastInspectionId(l.getId())
                .secondsSinceLastInspection(Math.max(0, seconds))
                .stale(seconds > STALE_SECONDS);

        lastFail.ifPresent(f -> b.lastFailAt(f.getInspectedAt()).lastFailId(f.getId()));
        return b.build();
    }

    @Transactional
    public InspectionResponseDto updateReview(Long id, String reviewStatusRaw) {
        ReviewStatus status = ReviewStatus.valueOf(reviewStatusRaw.trim().toUpperCase());
        InspectionLog log = inspectionLogRepository.findWithDefectsById(id)
                .orElseThrow(() -> new IllegalArgumentException("검사 이력을 찾을 수 없습니다. ID: " + id));
        log.applyReview(status);
        return InspectionResponseDto.from(inspectionLogRepository.save(log));
    }

    public static LocalDateTime parseDateStart(String date) {
        if (date == null || date.isBlank()) return null;
        if (date.length() <= 10) {
            return LocalDate.parse(date.substring(0, 10)).atStartOfDay();
        }
        return LocalDateTime.parse(date);
    }

    public static LocalDateTime parseDateEnd(String date) {
        if (date == null || date.isBlank()) return null;
        if (date.length() <= 10) {
            return LocalDate.parse(date.substring(0, 10)).atTime(23, 59, 59);
        }
        return LocalDateTime.parse(date);
    }

    public static InspectionSearchCriteria buildCriteria(
            String from, String to, String deviceId, String result,
            String board, String shift, String defectType, String reviewStatus) {
        InspectionResult res = null;
        if (result != null && !result.isBlank() && !"ALL".equalsIgnoreCase(result)) {
            res = InspectionResult.valueOf(result.toUpperCase());
        }
        return InspectionSearchCriteria.builder()
                .from(parseDateStart(from))
                .to(parseDateEnd(to))
                .deviceId(deviceId)
                .result(res)
                .board(board)
                .shift(shift)
                .defectType(defectType)
                .reviewStatus(reviewStatus)
                .build();
    }
}
