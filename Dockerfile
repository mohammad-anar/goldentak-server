# Use official Node.js image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package*.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Generate Prisma Client
RUN DATABASE_URL="postgresql://postgres:123456@postgres:5432/goldentak_db?schema=public" npx prisma generate

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 5001

# Start the application
CMD ["pnpm", "run", "start:prod"]