# Multi-stage production build
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install OpenSSL and build dependencies required by Prisma and native modules
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy package manifests for backend and admin-panel
COPY package*.json ./
COPY admin-panel/package*.json ./admin-panel/

# Install backend dependencies
RUN npm ci

# Install admin-panel dependencies
RUN cd admin-panel && npm ci

# Copy full source
COPY . .

# Generate Prisma client and build both backend and admin-panel
RUN npx prisma@6.11.1 generate
RUN npx tsup
RUN cd admin-panel && npm run ci:build

# Production runtime stage
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Install OpenSSL for Prisma runtime
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests and production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy generated Prisma engine/client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Copy built backend bundle and static assets (including admin-panel)
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public

EXPOSE 5000

CMD ["node", "build/index.cjs"]
