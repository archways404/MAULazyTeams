FROM node:20-bookworm-slim

WORKDIR /app

# Install Chromium + deps for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install deps (use npm ci since your root package.json is npm-style)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source (extension folder excluded by .dockerignore)
COPY . .

ENV PORT=4007
ENV HOST=0.0.0.0
EXPOSE 4007

CMD ["node", "main.js"]