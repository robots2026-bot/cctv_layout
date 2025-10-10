# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.cjs postcss.config.cjs index.html ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
