# 멀티스테이지: 호스트 node_modules는 .dockerignore로 제외하고, 이미지 안에서만 npm ci + build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/vite.config.ts ./

ENV NODE_ENV=production

# vite.config.ts 의 preview.port(5173) 와 동일 기본값. Cloud Run 등은 PORT=8080 로 덮어쓰면 됨.
EXPOSE 5173

CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port ${PORT:-5173}"]
