# Oracle service Docker image for Railway deployment
#
# PREREQUISITE: oracle/src/idl.json must exist before building this image.
# The idl.json is gitignored. Run `scripts/copy-idl.sh` after `anchor build`
# to copy it from the Anchor target directory into oracle/src/.
#
# Railway will set the PORT env var automatically; the health server reads it.

FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc
RUN npm prune --omit=dev
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/index.js"]
