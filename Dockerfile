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

# The DAR and its TypeScript bindings, as a stage of their own: `pnpm daml:codegen` builds this
# stage on the server and copies both back, since damlc is x86_64-only and Macs no longer run it.
FROM builder AS dar
COPY daml ./daml
RUN cd daml && rm -rf .daml/dist && dpm build \
	&& cd .. && dpm codegen-js daml/.daml/dist/*.dar -o daml.js

FROM dar AS app
# Codegen writes workspace packages, so it has to happen before install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec vite build

# Runtime dependencies only: the generated Daml bindings (workspace packages, so they have to be
# present for pnpm to link them) and the wallet SDK, which ships CommonJS that does not survive
# being bundled into an ES module. Everything else is bundled into build/.
FROM node:22-slim AS deps

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --from=app /app/daml.js ./daml.js
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:22-slim AS runtime

ARG GIT_SHA=unknown
# Readable from inside (the /version route) and from outside (docker inspect) alike.
ENV GIT_SHA=$GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA

WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=app /app/daml.js ./daml.js
COPY --from=app /app/build ./build
COPY package.json ./
# The DAR rides along: on startup the app uploads exactly the package this image was built from.
COPY --from=app /app/daml/.daml/dist ./dar

EXPOSE 3000
CMD ["node", "build"]
