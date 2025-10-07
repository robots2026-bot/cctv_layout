# CCTV 布局平台

一个面向工地场景的 CCTV 与网桥快速布局解决方案。前端提供基于 React + Konva 的画布工作台，后端基于 NestJS + PostgreSQL，支持设备自动同步、布局版本化与实时协作的基础能力。

## 功能目标

- 📡 **设备扫描同步**：接入现场扫描结果，实时推送设备状态。
- 🗺️ **画布布局**：在导入的背景图上拖拽放置摄像头、网桥等设备，调整连线与属性。
- 🔁 **版本管理**：保存布局快照，记录操作日志，支持回溯。
- ⚡ **实时协作**：通过 WebSocket 广播设备和布局变更，为多人协作打底。

## 目录结构

```
frontend/   # React + Vite + Zustand 画布工作台
backend/    # NestJS 服务，集成 TypeORM、WebSocket、活动日志
```

## 快速开始

### 前端

```bash
cd frontend
npm install
npm run dev          # 本地开发 http://localhost:5173
npm run build        # 生成生产构建
```

主要技术栈：
- React 18、TypeScript、Vite
- Zustand 管理项目、画布、实时状态
- react-konva 渲染设备节点与连线
- Tailwind CSS 构建深色界面

### 后端

```bash
cd backend
npm install
npm run build        # TypeScript 编译
npm run start:dev    # 本地开发（需要 PostgreSQL、Redis）
```

主要技术栈：
- NestJS 模块化架构（项目、设备、布局、文件、认证、实时）
- TypeORM + PostgreSQL 存储项目、设备、布局版本
- Redis + BullMQ 预留异步任务能力
- Socket.IO 网关推送设备与布局事件

## 开发约定

- 所有配置来源统一通过 `@nestjs/config` 管理。
- API 前缀为 `/api`，实时连接默认路径 `/realtime`。
- 前端通过 `VITE_API_BASE_URL` 与 `VITE_REALTIME_URL` 环境变量完成跨环境配置。
- Dockerfile 已分别提供前后端镜像构建示例。

更多架构设计与迭代计划请参阅 [DESIGN_PLAN.md](DESIGN_PLAN.md)。
