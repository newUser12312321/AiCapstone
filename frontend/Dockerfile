# 멀티스테이지: 호스트 node_modules는 .dockerignore로 제외하고, 이미지 안에서만 npm ci + build
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_PROXY_TARGET=http://backend:8080
ARG VITE_EDGE_CAPTURE_URL=http://edge:8000
ENV VITE_API_PROXY_TARGET=$VITE_API_PROXY_TARGET \
    VITE_EDGE_CAPTURE_URL=$VITE_EDGE_CAPTURE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache wget

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/vite.config.ts ./

ENV NODE_ENV=production

# vite.config.ts 의 preview.port(5173) 와 동일 기본값. Cloud Run 등은 PORT=8080 로 덮어쓰면 됨.
EXPOSE 5173

# 기본 실행 포트(5173). PORT를 바꿀 경우 compose에서 healthcheck 를 덮어쓰거나 조정하면 됩니다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:5173/ >/dev/null || exit 1

CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port ${PORT:-5173}"]
