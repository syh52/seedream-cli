# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SeeDream 图像生成平台 - 基于 BytePlus Ark SeeDream 5.0-lite 模型的图像生成工具，包含三个组件：

1. **Python CLI** (`image_generator.py`) - 快速测试和演示脚本
2. **Next.js Web App** (`web/`) - 移动优先 2 页面 UI，支持 Firebase 认证和图片存储
3. **MCP Server** (`web/mcp/`) - 让 Claude Code 直接生成图片的 MCP 服务器

支持三种图像生成模式：
- Text-to-Image（纯文本生成）
- Image-to-Image（单图参考编辑）
- Multi-Image（多图融合，最多 14 张）

## Commands

### Python CLI

```bash
pip3 install byteplus-python-sdk-v2
export ARK_API_KEY="your-api-key"
python3 image_generator.py
```

### Web App

```bash
cd web
npm install
cp .env.local.example .env.local  # 填入 Firebase 和 ARK API Key
npm run dev     # 开发服务器 http://localhost:3000
npm run build   # 生产构建
npm run lint    # ESLint 检查
```

### Cloud Functions

```bash
cd web/functions
npm install
npm run build          # TypeScript 编译
npm run build:watch    # 监听模式
npm run serve          # 本地 emulator
npm run logs           # 查看线上日志
```

### MCP Server

```bash
cd web/mcp
npm install
export ARK_API_KEY="your-api-key"
npm run dev      # 开发模式（tsx watch）
npm run build    # TypeScript 编译到 dist/
npm start        # 运行编译后的服务器

# 环境变量
TRANSPORT="stdio"    # stdio（默认）或 http
PORT=3000            # HTTP 模式端口
```

### 关键约束

- **Node 24** 是 Web App 和 Cloud Functions 的硬性要求（`package.json` engines 字段）
- `web/tsconfig.json` 必须排除 `mcp/` 目录，否则 Next.js 会尝试编译 MCP Server 代码导致构建失败

## Architecture

### 数据流

```
用户输入 prompt → POST /api/submit-task → 创建 Entry (status: 'active')
                                                  ↓
                            Cloud Function (onDocumentCreated) 自动触发
                            region: asia-east1, memory: 512MiB, timeout: 9min
                                                  ↓
                            调用 SeeDream API → 返回临时 URL (24h)
                                                  ↓
                            上传 Firebase Storage（永久） + 更新 Entry (status: 'done')
                                                  ↓
                            onSnapshot 实时更新 UI
```

### Firestore 数据模型

**统一 `entries` Collection**（合并了旧 `images` + `tasks`）：
- `Entry`: 3 状态 (`active` | `done` | `failed`)，嵌入 `EntryImage[]` 数组
- `EntryImage`: 每张图的 URL、尺寸、状态 (`pending` | `done` | `failed`)
- Cloud Function 内部字段隔离在 `_cf` 命名空间（workerId, lastHeartbeat, retryCount）
- 软删除：`deleted: boolean`，查询时总是过滤 `deleted === false`
- 详细类型定义见 `web/src/types/index.ts`

**Firestore 复合索引**（定义在 `web/firestore.indexes.json`，部署时自动创建）：
- `(status, deleted, createdAt desc)` - Gallery 全部
- `(userId, deleted, createdAt desc)` - Gallery 我的
- `(liked, deleted, createdAt desc)` - Gallery 收藏

### API Configuration

- **Endpoint**: `https://ark.ap-southeast.bytepluses.com/api/v3/images/generations`
- **Model**: 所有组件统一使用自定义端点 `ep-20260226145427-hdhqc`（SeeDream 5.0-lite，内容预过滤已关闭）
- **尺寸**: 2K, 4K, 1:1, 3:4, 4:3, 9:16, 16:9, 3:2, 2:3, 21:9, 4K-9:16（5.0-lite 不支持 1K）
- **批量生成**: 默认每次生成 4 张图片，每张独立 API 调用（并行，最多 2 并发）
- **限制**: 输出图片链接 24 小时有效，需及时持久化到 Firebase Storage

### Key Patterns

**三种生成模式的 API 差异**：
| 模式 | `sequential_image_generation` | `image` 参数 |
|------|------|------|
| text | `auto` | 不传 |
| image | `auto` | 单个 URL/base64 |
| multi | **`disabled`** ← 关键 | URL 数组 (2-14 张) |

**流式响应事件类型**（SSE）：
- `image_generation.partial_succeeded` - 单张图片生成成功
- `image_generation.partial_failed` - 单张图片生成失败
- `image_generation.completed` - 全部完成，包含 usage 信息

**响应式布局**（移动优先）：
- 底部 TabBar 导航 (h-14)
- Gallery: `columns-2 md:columns-4` masonry grid
- Create: 水平滚动图片 + 底部固定输入栏

**UI 组件**：
- 使用 shadcn/ui（基于 Radix UI 原语）
- 样式: Tailwind CSS v4 + tw-animate-css
- 添加新组件: `npx shadcn@latest add <component>`

## MCP 配置

项目根目录的 `.mcp.json` 配置了远程 MCP 服务器，让 Claude Code 可以直接使用 SeeDream 工具：

```json
{
  "mcpServers": {
    "seedream-remote": {
      "type": "http",
      "url": "https://seedream-mcp-server-production.up.railway.app/mcp"
    }
  }
}
```

### 可用 MCP 工具

| 工具 | 功能 | 说明 |
|------|------|------|
| `seedream_generate` | 文本生成图片 | 纯文本描述生成图片 |
| `seedream_edit` | 编辑现有图片 | 单图参考 + 文本指令 |
| `seedream_blend` | 多图融合 | 2-14 张图片融合 |
| `seedream_variations` | 批量生成变体 | 2-15 张变体图片 |
| `seedream_submit` | 异步提交任务 | Claude.ai 用，Web App 查看结果 |
| `seedream_status` | 服务状态检查 | 不消耗 API 配额 |

### 使用方式

在 Claude Code 中，可以直接调用这些工具生成图片。例如：
- "帮我生成一张赛博朋克风格的城市夜景"
- "用这张图片生成一个卡通版本"

### Firebase 同步

MCP Server 支持自动将生成的图片同步到 Web App 图库（写入 `entries` Collection）。

**本地开发配置**：
```bash
export FIREBASE_SERVICE_ACCOUNT_PATH="$HOME/.firebase/seedream-gallery-firebase-adminsdk-fbsvc-41732fbd28.json"
export FIREBASE_USER_ID="5Rpcgioc1KVzitEezOwWoLQPqbz1"
export FIREBASE_USER_NAME="Yihang Shen"
```

**Railway 环境变量**（已配置）：

| 变量 | 值 |
|------|------|
| `FIREBASE_SERVICE_ACCOUNT` | 服务账号 JSON 内容 |
| `FIREBASE_USER_ID` | `5Rpcgioc1KVzitEezOwWoLQPqbz1` |
| `FIREBASE_USER_NAME` | `Yihang Shen` |

⚠️ **安全提醒**：服务账号密钥存储在 `~/.firebase/`，不要提交到 Git！

## Deployment

### Web App + Cloud Functions

**线上地址**: https://seedream-gallery.firebaseapp.com

```bash
cd web
firebase deploy --only hosting,functions  # 部署 Hosting + Cloud Functions
firebase deploy --only functions          # 仅部署 Cloud Functions
```

Firebase 配置:
- Project ID: `seedream-gallery`
- Region: `asia-east1`
- 需要 `ARK_API_KEY` 作为 Firebase Secret

### MCP Server 部署

**线上地址**: https://seedream-mcp-server-production.up.railway.app/mcp

⚠️ **MCP Server 有独立的 GitHub 仓库用于 Railway 部署，禁止在主仓库中直接推送！**

```bash
cd /tmp
git clone https://github.com/syh52/seedream-mcp-server.git
# 复制修改后的文件
cp web/mcp/src/**/*.ts /tmp/seedream-mcp-server/src/
cp web/mcp/package.json /tmp/seedream-mcp-server/
# 提交并推送（Railway 自动部署）
cd /tmp/seedream-mcp-server && git add . && git commit -m "description" && git push
```

## 测试账号

开发测试用邮箱密码账号：
- **邮箱**: `beelzebub1949+test@gmail.com`
- **密码**: `SeeDream2024Test!`

## 参考文档

详细 API 参数和提示词指南见 `docs/seedream-4.5-knowledge-base.md`
