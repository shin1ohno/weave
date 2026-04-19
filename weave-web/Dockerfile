# Next.js standalone production image. Build context = weave-web directory.
FROM node:20-slim AS deps
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /src
COPY --from=deps /src/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
RUN useradd --system --home /app --uid 1002 nextjs \
    && chown -R nextjs:nextjs /app
COPY --from=builder --chown=nextjs:nextjs /src/public ./public
COPY --from=builder --chown=nextjs:nextjs /src/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /src/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
