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
# Create /app and hand it to the `node` user before switching, so npm
# can write node_modules as non-root. WORKDIR alone would mkdir /app
# owned by root and the subsequent `npm install` would EACCES.
RUN mkdir -p /app && chown node:node /app
WORKDIR /app
ENV NODE_ENV=production
USER node
COPY --chown=node:node package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --chown=node:node --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
