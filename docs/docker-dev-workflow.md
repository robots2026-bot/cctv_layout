# Docker 开发模式调整

## 背景
- 希望前后端容器直接挂载源码，便于本地热更新，避免频繁重建镜像。

## 主要改动
1. 后端：`backend/Dockerfile` 改为 Node 基础镜像 + `npm run start:dev`，`docker-compose.yml` 为服务挂载 `./backend` 与 `backend_node_modules` 卷，并在启动时执行 `npm install`。
2. 前端：`frontend/Dockerfile` 改为 Node 基础镜像运行 Vite Dev Server，`docker-compose.yml` 增加 `./frontend` 及 `frontend_node_modules` 卷，使用 `npm run dev -- --host 0.0.0.0 --port 5173` 并通过 Vite `proxy` 指向 `http://backend:3000`。

## 验证
- `docker compose up backend`：Nest `watch` 模式正常启动。
- `docker compose up frontend`：Vite Dev Server 启动后暴露 `http://localhost:5173`。

## 注意事项
- 首次启动会在容器内安装依赖，需保留 `backend_node_modules`、`frontend_node_modules` 卷。
- 生产/CI 依然建议使用原先的构建产物镜像流程。
- 若需自定义代理目标，可在前端容器设置 `VITE_API_PROXY_TARGET` 环境变量。
