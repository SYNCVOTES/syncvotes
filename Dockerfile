# Everything is built inside the image: the DAR, the TypeScript bindings and the app. The host
# only needs Docker. The Daml toolchain is heavy, but it lives in a build stage and never reaches
# the final image.
FROM node:22-slim AS builder

WORKDIR /app
RUN corepack enable && apt-get update \
	&& apt-get install -y --no-install-recommends curl ca-certificates default-jre-headless \
	&& rm -rf /var/lib/apt/lists/*

# dpm bootstraps itself, then pulls the SDK version pinned in daml/daml.yaml.
ENV DPM_HOME=/opt/dpm
ENV PATH=/opt/dpm/bin:$PATH
RUN VERSION="$(curl -sS https://get.digitalasset.com/install/latest)" \
	&& ARCH="$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')" \
	&& curl -sSLf "https://get.digitalasset.com/install/dpm-sdk/dpm-${VERSION}-linux-${ARCH}.tar.gz" \
		--output /tmp/dpm.tar.gz \
	&& tar xzf /tmp/dpm.tar.gz -C /tmp \
	&& cd "/tmp/linux-${ARCH}" && ./bin/dpm bootstrap . \
	&& rm -rf /tmp/dpm.tar.gz "/tmp/linux-${ARCH}"

# The SDK download is the slowest step, so it gets its own layer keyed on daml.yaml alone.
COPY daml/daml.yaml ./daml/daml.yaml
RUN dpm install "$(grep '^sdk-version:' daml/daml.yaml | cut -d' ' -f2)"

COPY daml ./daml
RUN pnpm daml:build 2>/dev/null || (cd daml && rm -rf .daml/dist && dpm build)

# Codegen writes workspace packages, so it has to happen before install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN dpm codegen-js daml/.daml/dist/*.dar -o daml.js \
	&& pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec vite build

# Production dependencies only — the generated packages must be present, they are workspace members.
FROM node:22-slim AS deps

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --from=builder /app/daml.js ./daml.js
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/daml.js ./daml.js
COPY --from=builder /app/build ./build
# The DAR rides along so deployment can upload exactly the package this image was built from.
COPY --from=builder /app/daml/.daml/dist ./dar
COPY package.json ./

EXPOSE 3000
CMD ["node", "build"]
