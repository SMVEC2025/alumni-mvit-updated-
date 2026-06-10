# Production container for the SMVEC Alumni API (Google Cloud Run).
#
# Cloud Run injects the PORT env var (8080) and routes traffic to it; the app
# reads process.env.PORT (config/env.js) and binds 0.0.0.0 (server.js), so no
# port is hardcoded here. Build context is the backend/ directory.
FROM node:20-slim

# Small init so SIGTERM is forwarded to node for graceful shutdown (Cloud Run
# sends SIGTERM on scale-in; server.js handles it).
RUN apt-get update && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# Install only production deps, using the lockfile for reproducible builds.
# Copy manifests first so this layer is cached unless deps change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App source.
COPY . .

# Drop root — node:* images ship an unprivileged `node` user.
USER node

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/server.js"]
