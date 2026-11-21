# App image, built by CI. The same image runs the app, the migrations and the seed script.

FROM node:24-alpine AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm version comes from "packageManager" in package.json
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# The database needs no settings here: the connection is created on the first query (src/db/index.ts).
# next build imports the login module, which requires settings; during the build nobody logs in
# and no email is sent, so the values are placeholders.
RUN BETTER_AUTH_SECRET=build-only-placeholder-secret-not-used-at-runtime BETTER_AUTH_URL=http://localhost:3000 \
    pnpm build \
 && rm -rf .next/cache

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
