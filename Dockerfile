# Use official Node.js image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install system dependencies needed by Prisma on Alpine and install pnpm
RUN apk add --no-cache openssl libc6-compat && npm install -g pnpm

# Set temporary environment variables for build-time Prisma Client generation
ENV DATABASE_URL="postgresql://postgres:123456@postgres:5432/goldentak_db?schema=public"
ENV DIRECT_URL="postgresql://postgres:123456@postgres:5432/goldentak_db?schema=public"

# Copy dependency specifications and Prisma config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* tsconfig.json* prisma.config.ts* ./
COPY prisma ./prisma/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy application files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript to JavaScript
RUN pnpm run build

# Setup entrypoint permissions
RUN chmod +x ./docker-entrypoint.sh

# Expose the application port
EXPOSE 5001

# Execute startup entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]