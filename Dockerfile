FROM node:22-bookworm AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build

ARG APP_PORT=3000
ARG APP_DATABASE=mysql
ARG CLIENT_API_URL=
ARG CLIENT_WS_URL=
ARG CLIENT_BASE_PATH=

ENV APP_PORT=${APP_PORT}
ENV APP_DATABASE=${APP_DATABASE}
ENV CLIENT_API_URL=${CLIENT_API_URL}
ENV CLIENT_WS_URL=${CLIENT_WS_URL}
ENV CLIENT_BASE_PATH=${CLIENT_BASE_PATH}

COPY . .
RUN npm run client-build && npm run server-build && npm prune --omit=dev

FROM node:22-bookworm AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV APP_PORT=3000
ENV APP_DATABASE=mysql

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/database ./database

EXPOSE 3000
USER node
CMD ["node", "dist/server/server/index.js"]
