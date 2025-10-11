# 后端 WebSocket 启动修复

## 背景
- 本地执行 `DB_PORT=55432 npm run start` 会在 WebSocket 模块初始化阶段立即退出，日志在 `@nestjs/core/helpers/load-adapter.js` 内提示缺少驱动。

## 原因
- 项目已启用 `@nestjs/websockets` 与 `socket.io`，但未安装默认适配器 `@nestjs/platform-socket-io`，Nest 在初始化网关时会调用 `loadAdapter` 并直接 `process.exit(1)`。

## 解决
1. 在后端容器内安装缺失依赖：`docker compose run --rm backend npm install @nestjs/platform-socket-io@10.3.3`。
2. 重新构建以生成最新 `dist`：`docker compose run --rm backend npm run build`。

## 验证
- 再次运行 `npm run start`（确保数据库环境变量正确或使用 compose 中的 postgres 服务），后台不再在启动阶段退出。
