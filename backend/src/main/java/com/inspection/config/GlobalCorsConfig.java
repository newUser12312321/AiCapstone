package com.inspection.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

/**
 * 브라우저 CORS.
 * <p>
 * {@code InspectionController}에 있던 localhost 전용 {@code @CrossOrigin} 때문에
 * {@code http://공인IP:5173} 등에서 OPTIONS/DELETE 같은 요청 시 403이 나는 문제를 피하기 위해
 * 패턴 기반으로 허용한다.
 * <p>
 * 운영에서 출처 제한 시 {@code APP_CORS_ALLOWED_ORIGIN_PATTERNS} 또는
 * {@code application.yml}의 {@code app.cors.allowed-origin-patterns}에
 * 목록만 넣으면 된다. (예: {@code https://dash.example.com,http://localhost:*})
 */
@Configuration
public class GlobalCorsConfig implements WebMvcConfigurer {

    /** 쉼표로 구분. 기본 "*" — 모든 호스트의 브라우저 출처 허용(자격증명 미사용 가정). */
    @Value("${app.cors.allowed-origin-patterns:*}")
    private String allowedOriginPatternsRaw;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] patterns = Arrays.stream(allowedOriginPatternsRaw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
        if (patterns.length == 0) {
            patterns = new String[]{"*"};
        }
        registry.addMapping("/**")
                .allowedOriginPatterns(patterns)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }
}
