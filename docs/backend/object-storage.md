# 对象存储集成方案（2025-10）

## 1. 背景
- 目前蓝图与背景图通过 Data URL 嵌入布局版本 `metadata` 中；当图纸较大时容易触发接口请求体超限（413）。
- 项目规范要求“所有服务需提供 Dockerfile，并导出 Prometheus 指标”，文件服务也应统一纳入部署与监控。
- 需要一个可扩展、可靠的文件存储方案，用于蓝图、背景图、导出文件以及后续的录像截图等资产。

## 2. 设计目标
1. 前端通过预签名 URL 上传文件，避免大文件经过应用服务器。
2. 后端统一记录文件元数据（对象键、尺寸、大小、用途、所属项目/布局）。
3. 与现有 NestJS `FilesModule` 整合，提供上传、删除、授权访问、生命周期管理能力。
4. 在 Docker Compose 与生产环境均可使用（开发阶段采用 MinIO，本地持久化到 `./storage`，生产接入 S3 兼容对象存储）。
5. 满足安全要求：HTTPS、Token 鉴权、对象访问控制、敏感信息脱敏或加密存储。
6. 便于扩展的后处理流水线（缩略图生成、图像优化、格式转换），并暴露 Prometheus 指标。

## 3. 方案概览
```
Frontend  ──(1) 请求上传凭证──►  FilesService (NestJS)
           ──(2) 直传对象──────►  Object Storage (MinIO/S3)
           ──(3) 回传确认──────►  FilesService
           ──(4) 更新布局元数据/通知
```

1. 前端调用 `POST /projects/:projectId/files/presign`，提交文件名、MIME、大小、用途（`blueprint`、`background` 等）。
2. FilesService 校验参数，生成对象键与预签名上传 URL（默认 15 分钟有效），同时写入 `project_files` 表草稿记录（状态 `pending_upload`）。
3. 前端使用预签名 URL 直接上传到对象存储。
4. 上传成功后调用 `POST /projects/:projectId/files/complete`，携带对象键、Etag、实际大小、图像尺寸（可选）等信息。FilesService 校验并更新元数据为 `available`。
5. 布局保存时，将返回的对象 URL 写入 `layout_versions.metadata.blueprint.url`，不再嵌入 Base64 Data URL。
6. FilesService 通过 BullMQ 队列触发后处理（生成 1024px 缩略图、WebP 版本），并在 Prometheus 暴露上传成功率、大小直方图等监控。

## 4. 模块与数据设计

### 4.1 目录结构与命名
- Bucket：`cctv-layout-assets`
- 对象键：`<env>/<projectId>/<category>/<yyyy>/<mm>/<dd>/<uuid>.<ext>`
  - `category`：`blueprints` | `backgrounds` | `exports` | `other`
  - 开发环境的 `<env>` 为 `dev`，生产为 `prod`。

### 4.2 数据表 `project_files`
| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| id | uuid | 主键 |
| project_id | uuid | 归属项目 |
| layout_id | uuid? | 可选，关联布局 |
| category | text | blueprint/background/export/other |
| object_key | text | 对象存储 key |
| public_url | text | 对外访问 URL（CDN/静态域名） |
| filename | text | 原始文件名 |
| mime_type | text | MIME |
| size_bytes | bigint | 文件大小 |
| width | int? | 图像宽 |
| height | int? | 图像高 |
| status | text | pending_upload / available / deleted |
| etag | text? | 对象存储返回的 Etag |
| checksum | text? | MD5/SHA256，防篡改 |
| created_by | uuid? | 上传用户 |
| created_at/updated_at/deleted_at | timestamp | 审计字段 |

### 4.3 NestJS 服务调整
- `FilesModule` 依赖新增：
  - `@aws-sdk/client-s3`、`@aws-sdk/s3-request-presigner`（或 `@aws-sdk/lib-storage`）。
  - `@nestjs/config` 中注入 `OBJECT_STORAGE_*` 环境变量。
- `FilesService` 增加方法：
  - `createPresignedUpload(dto, user)`：生成对象键、写入 `project_files` 草稿。
  - `completeUpload(fileId, dto)`：校验 Etag/大小，更新状态与尺寸元数据。
  - `generateAccessUrl(fileId)`：返回签名下载链接或 CDN URL。
  - `deleteObject(fileId)`：删除对象并标记记录。
- 新建 `FilesProcessor`，监听 `files.process` 队列，负责缩略图生成与 WebP 转码（调用 `sharp`）。
- 在 `FilesController` 中新增：
  - `POST /projects/:projectId/files/presign`
  - `POST /projects/:projectId/files/:fileId/complete`
  - `GET /projects/:projectId/files/:fileId`（返回 metadata + 访问 URL）
  - `DELETE /projects/:projectId/files/:fileId`

## 5. 前端配合方案
1. 布局工作台导入蓝图时，先调用预签名接口获得 `uploadUrl` 与 `objectKey`。
2. 使用浏览器原生 `fetch`/`XMLHttpRequest` 或 `AWS SDK` 上传文件，带上 `Content-Type`。
3. 上传成功后调用 `complete` 接口，获取 `publicUrl` 与尺寸信息。
4. 内部 `canvasStore` 存储 `{ url: publicUrl, naturalWidth, naturalHeight, ... }`；保存布局版本时不再包含 Data URL。
5. 导入失败或中途取消时，调用 `DELETE` 接口清理草稿对象。
6. 仅在预签名阶段执行客户端压缩（仍建议提供压缩提示，但允许用户选择“保持原图”）。一旦文件服务上线，压缩逻辑可配置为跳过。

## 6. 安全与权限
- 所有 Files API 需校验用户具备项目上传权限（owner/maintainer）。
- 对象键包含项目 ID，`complete` 接口需要校验当前用户属于该项目。
- 预签名 URL 设置最短必要的有效期（15 分钟），限制允许的 HTTP 方法与 Content-Type。
- 通过 `Content-Length` 限制每类资产的最大体积（蓝图 ≤ 20 MB，背景图 ≤ 10 MB，导出文件 ≤ 50 MB）。
- 对象存储桶禁用公共读取，统一通过 CDN 域名或短期签名访问。
- 对敏感图像可加入透明水印或加密存储（预留扩展点）。

## 7. 运维与监控
- 环境变量：
  - `OBJECT_STORAGE_DRIVER=s3|minio`
  - `OBJECT_STORAGE_ENDPOINT`
  - `OBJECT_STORAGE_REGION`
  - `OBJECT_STORAGE_ACCESS_KEY`
  - `OBJECT_STORAGE_SECRET_KEY`
  - `OBJECT_STORAGE_BUCKET`
  - `OBJECT_STORAGE_PUBLIC_BASE_URL`
- Docker Compose 增加 `minio` 服务与 `mc` 初始化脚本，默认创建 bucket。
- Prometheus 指标：
  - `files_upload_total{category,status}`
  - `files_size_bytes_bucket`
  - `files_processing_duration_seconds`
- 日志记录：上传成功、失败、删除操作均写入 Activity Log。

## 8. 迁移计划
1. **阶段一**：后端实现 MinIO 接口，前端保留现有 Data URL 逻辑，隐藏实验开关。
2. **阶段二**：前端接入预签名上传，新增“保持原图/压缩上传”开关，蓝图默认走对象存储。
3. **阶段三**：移除 Data URL 存储路径，旧版本布局在首次加载时执行一次性迁移（检测 Base64 → 上传 → 替换 URL）。
4. **阶段四**：扩展到导出文件、录像截图等资源。

## 9. 风险与缓解
- **对象存储不可用**：预签名生成失败时回退到本地压缩 + Data URL，通知用户稍后重试；同时对 FilesService 增加重试与熔断。
- **上传过程被中断**：草稿记录定期扫描，未完成上传超过 1 天自动清理。
- **链路安全**：预签名使用 HTTPS Endpoint，前端强制 TLS；生产环境结合 WAF 与 CDN 鉴权。
- **成本与容量**：定期统计文件大小、使用生命周期策略自动清理被删除项目或历史导出。

---
> 设计通过后，下一步在 `FilesModule` 中落地 MinIO 客户端、数据库迁移，随后调整前端流程接入新接口。
