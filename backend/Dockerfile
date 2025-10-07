# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json tsconfig.json tsconfig.build.json nest-cli.json jest.config.ts ./
COPY src ./src
RUN npm install --frozen-lockfile && npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --frozen-lockfile
COPY --from=base /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
