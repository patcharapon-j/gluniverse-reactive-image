FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules (opus)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

CMD ["npx", "tsx", "src/index.ts"]
