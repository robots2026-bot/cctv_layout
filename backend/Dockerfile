# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY tsconfig.json tsconfig.build.json nest-cli.json jest.config.ts ./

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
