# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Production stage
FROM node:18-alpine
WORKDIR /app

# Install dependencies for Alloy (curl for health checks, ca-certificates for TLS)
RUN apk add --no-cache curl ca-certificates

# Download Grafana Alloy binary (v1.8.3 — stable release for Alpine/amd64)
RUN ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') && \
    curl -fsSL "https://github.com/grafana/alloy/releases/download/v1.8.3/alloy-linux-${ARCH}.zip" \
    -o /tmp/alloy.zip && \
    unzip /tmp/alloy.zip -d /tmp/alloy-bin && \
    mv /tmp/alloy-bin/alloy-linux-${ARCH} /usr/local/bin/alloy && \
    chmod +x /usr/local/bin/alloy && \
    rm -rf /tmp/alloy.zip /tmp/alloy-bin

# Add non-root user
RUN addgroup -g 1001 -S elysium && \
    adduser -S elysium -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/moleculer.config.js ./
COPY --from=builder /app/services ./services
COPY --from=builder /app/mixins ./mixins
COPY --from=builder /app/middlewares ./middlewares
COPY --from=builder /app/config ./config
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/alloy ./alloy

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER elysium

ENV NODE_ENV=production
EXPOSE 3001 3030

CMD ["/docker-entrypoint.sh"]
