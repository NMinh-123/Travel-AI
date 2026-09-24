# syntax=docker/dockerfile:1
#
# Image của web: Express + client đã build. Xem claude_production.md, Bước 2.
#
#   docker buildx build --platform linux/amd64,linux/arm64 -t travel-ai-web .
#
# Tầng build chạy trên kiến trúc CỦA MÁY BUILD ($BUILDPLATFORM): dist/ là JS/CSS thuần nên giống
# nhau trên mọi kiến trúc, và build dưới giả lập QEMU chậm hơn nhiều lần. Thứ duy nhất phụ thuộc
# kiến trúc là engine của Prisma, nên `binaryTargets` trong db/schema.prisma khai đủ cả hai.

FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS build
WORKDIR /app
# Prisma dò phiên bản OpenSSL để chọn engine; thiếu openssl thì nó đoán 1.1 và chọn sai.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# --ignore-scripts: postinstall chạy `prisma generate` khi chưa có db/schema.prisma.
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate && npm run build:client && npm run build:server

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# --ignore-scripts vì postinstall gọi Prisma CLI, mà CLI là devDependency. Client đã sinh sẵn
# (kèm engine cho cả amd64 và arm64) được chép sang từ tầng build ở dòng dưới.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# /api/health trả 503 khi mất database, nên dùng được làm healthcheck mà không cần thêm endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server.cjs"]
