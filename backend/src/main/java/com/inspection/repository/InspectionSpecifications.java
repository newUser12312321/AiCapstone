package com.inspection.repository;

import com.inspection.domain.entity.DefectDetail;
import com.inspection.domain.entity.InspectionLog;
import com.inspection.domain.enums.InspectionResult;
import com.inspection.domain.enums.ReviewStatus;
import com.inspection.dto.InspectionSearchCriteria;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public final class InspectionSpecifications {

    private InspectionSpecifications() {}

    public static Specification<InspectionLog> fromCriteria(InspectionSearchCriteria c) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (c.getFrom() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("inspectedAt"), c.getFrom()));
            }
            if (c.getTo() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("inspectedAt"), c.getTo()));
            }
            if (c.getDeviceId() != null && !c.getDeviceId().isBlank()) {
                predicates.add(cb.equal(root.get("deviceId"), c.getDeviceId().trim()));
            }
            if (c.getResult() != null) {
                predicates.add(cb.equal(root.get("result"), c.getResult()));
            }
            if (c.getBoard() != null && !c.getBoard().isBlank()) {
                predicates.add(cb.equal(root.get("silkBoardName"), c.getBoard().trim()));
            }
            if (c.getReviewStatus() != null && !c.getReviewStatus().isBlank()) {
                try {
                    ReviewStatus rs = ReviewStatus.valueOf(c.getReviewStatus().trim().toUpperCase());
                    if (rs == ReviewStatus.PENDING) {
                        predicates.add(cb.or(
                                cb.isNull(root.get("reviewStatus")),
                                cb.equal(root.get("reviewStatus"), ReviewStatus.PENDING)
                        ));
                    } else {
                        predicates.add(cb.equal(root.get("reviewStatus"), rs));
                    }
                } catch (IllegalArgumentException ignored) {
                    // ignore invalid review filter
                }
            }
            if (c.getShift() != null && !c.getShift().isBlank()) {
                var hourExpr = cb.function("hour", Integer.class, root.get("inspectedAt"));
                switch (c.getShift().trim().toUpperCase()) {
                    case "DAY" -> predicates.add(cb.between(hourExpr, 6, 13));
                    case "SWING" -> predicates.add(cb.between(hourExpr, 14, 21));
                    case "NIGHT" -> predicates.add(cb.or(
                            cb.between(hourExpr, 22, 23),
                            cb.between(hourExpr, 0, 5)
                    ));
                    default -> { }
                }
            }
            if (c.getDefectType() != null && !c.getDefectType().isBlank()) {
                Join<InspectionLog, DefectDetail> defects = root.join("defects", JoinType.INNER);
                predicates.add(cb.like(defects.get("defectType"), "%" + c.getDefectType().trim() + "%"));
                if (query != null) {
                    query.distinct(true);
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    public static Specification<InspectionLog> withResult(InspectionResult result) {
        return (root, query, cb) -> cb.equal(root.get("result"), result);
    }
}
