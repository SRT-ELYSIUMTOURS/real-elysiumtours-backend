# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Production stage
FROM node:18-alpine
WORKDIR /app

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

USER elysium

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
