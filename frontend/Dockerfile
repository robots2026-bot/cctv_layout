# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.cjs postcss.config.cjs ./
COPY index.html ./
COPY src ./src
RUN npm install --frozen-lockfile && npm run build

FROM nginx:1.25-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
