# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for build (optional)
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# Production Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install FFmpeg for video processing
RUN apk add --no-cache ffmpeg

# Copy necessary files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts

# Port for Next.js
EXPOSE 3000

# Default command (can be overridden in docker-compose for worker)
CMD ["npm", "start"]
