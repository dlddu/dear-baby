# Two-stage build: compile TypeScript in the builder stage, then copy the
# compiled output + production dependencies into a slim runtime image.

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Non-root user — the node image already ships with one but let's be
# explicit so we don't rely on the default UID.
USER node
COPY --chown=node:node package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --chown=node:node --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
