# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SeeDream 图像生成平台 - 基于 BytePlus Ark SeeDream 4.5 模型的图像生成工具，包含三个组件：

1. **Python CLI** (`image_generator.py`) - 快速测试和演示脚本
2. **Next.js Web App** (`web/`) - 完整的用户界面，支持 Firebase 认证和图片存储
3. **MCP Server** (`web/mcp/`) - 让 Claude Code 直接生成图片的 MCP 服务器

支持四种图像生成模式：
- Text-to-Image（纯文本生成）
- Image-to-Image（单图参考编辑）
- Multi-Image（多图融合，最多 14 张）
- Batch Generation（批量生成，最多 15 张）

## Commands

### Python CLI

```bash
pip3 install byteplussdkarkruntime
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

## Architecture

### Web App 结构 (`web/src/`)

```
app/
├── api/generate/route.ts   # SeeDream API 代理（服务端保护 API Key）
├── create/page.tsx         # 图片生成页面
├── organize/page.tsx       # 图库管理页面
├── login/page.tsx          # 登录页面
└── layout.tsx              # 根布局（含 AuthProvider）

components/
├── ui/                     # shadcn/ui 组件（基于 Radix UI）
├── layout/
│   ├── Sidebar.tsx         # 桌面端侧边栏导航（md:flex）
│   └── MobileNav.tsx       # 移动端汉堡菜单（Sheet 抽屉）
└── Providers.tsx           # Context 组合

lib/
├── firebase.ts             # Firebase 初始化
├── firestore.ts            # Firestore CRUD 操作
└── utils.ts                # cn() 工具函数

contexts/
└── AuthContext.tsx         # Firebase Auth 状态管理

types/
└── index.ts                # TypeScript 类型定义
```

### MCP Server 结构 (`web/mcp/src/`)

```
src/
├── index.ts              # 入口点（stdio + http 双模式）
├── services/
│   └── seedream.ts       # SeeDream API 客户端（核心业务逻辑）
├── schemas/
│   └── index.ts          # Zod 验证 schema（输入 + 输出）
└── tools/
    ├── generate.ts       # 文本生成图片
    ├── edit.ts           # 图片编辑
    ├── blend.ts          # 多图融合
    ├── variations.ts     # 批量变体
    └── status.ts         # 健康检查
```

### 数据流

1. 用户在 `/create` 页面输入 prompt → 调用 `/api/generate` API Route
2. API Route 添加 `ARK_API_KEY` 后转发请求到 SeeDream API
3. 生成的图片 URL（24h 有效）存入 Firestore，同时上传到 Firebase Storage 持久化
4. `/organize` 页面通过 Firestore 实时订阅展示用户图库

### API Configuration

- **Endpoint**: `https://ark.ap-southeast.bytepluses.com/api/v3/images/generations`
- **Model**: `seedream-4-5-251128`（Web App 使用 Model ID）或 `ep-20260123220136-f8bx7`（CLI 使用 Endpoint ID）
- **尺寸**: 支持 6 种比例 - 3:4, 4:3, 9:16, 16:9, 1:1, 2K（默认 3:4）
- **批量生成**: 默认每次生成 4 张图片
- **限制**: 输出图片链接 24 小时有效，需及时持久化

### Key Patterns

**流式响应处理**（CLI 使用）：
- `image_generation.partial_succeeded` - 单张图片生成成功
- `image_generation.partial_failed` - 单张图片生成失败
- `image_generation.completed` - 全部完成，包含 usage 信息

**Firestore 数据模型** (`ImageRecord`)：
- `imageUrl` - Firebase Storage URL（永久）
- `originalUrl` - SeeDream API URL（临时 24h）
- `liked` / `deleted` - 软删除和收藏标记

**响应式布局**：
- 断点: `md` (768px) 为桌面/移动端分界
- 桌面端: Sidebar 固定 256px 宽度
- 移动端: Sidebar 隐藏，使用 MobileNav 汉堡菜单

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
| `seedream_status` | 服务状态检查 | 不消耗 API 配额 |

### 使用方式

在 Claude Code 中，可以直接调用这些工具生成图片。例如：
- "帮我生成一张赛博朋克风格的城市夜景"
- "用这张图片生成一个卡通版本"

### Firebase 同步

MCP Server 支持自动将生成的图片同步到 Web App 图库。

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

**线上地址**: https://seedream-gallery.firebaseapp.com

```bash
cd web
firebase deploy --only hosting  # 部署到 Firebase Hosting + Cloud Functions
```

Firebase 配置:
- Project ID: `seedream-gallery`
- Region: `asia-east1`
- 需要 `ARK_API_KEY` 作为 Firebase Secret

### MCP Server 部署

**线上地址**: https://seedream-mcp-server-production.up.railway.app/mcp

MCP Server 独立部署在 Railway 上，源码在单独的 GitHub 仓库。

## 测试账号

开发测试用邮箱密码账号：
- **邮箱**: `beelzebub1949+test@gmail.com`
- **密码**: `SeeDream2024Test!`

## 参考文档

详细 API 参数和提示词指南见 `docs/seedream-4.5-knowledge-base.md`
