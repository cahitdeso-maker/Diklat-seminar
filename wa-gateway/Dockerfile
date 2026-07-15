# ============================================
# WA Gateway - Dockerfile
# ============================================
# Build: docker build -t wa-gateway .
# Run:   docker run -d --name wa-gateway -p 3000:3000 -v wa-auth:/app/auth_info_baileys wa-gateway
# ============================================

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Buat direktori untuk session dan logs
RUN mkdir -p auth_info_baileys logs

# Expose port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start
CMD ["node", "src/index.js"]
