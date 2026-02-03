# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SeeDream Gallery Web App - Next.js 16 应用，提供图像生成、图库管理功能。使用 Firebase 进行认证和存储。

## Commands

```bash
npm run dev     # 开发服务器 http://localhost:3000
npm run build   # 生产构建
npm run lint    # ESLint 检查

# 部署
firebase deploy --only hosting  # 部署到 Firebase Hosting + Cloud Functions

# 添加 UI 组件
npx shadcn@latest add <component>
```

## Environment Variables

复制 `.env.local.example` 到 `.env.local`，填入：
- `NEXT_PUBLIC_FIREBASE_*` - Firebase 客户端配置
- `ARK_API_KEY` - SeeDream API 密钥（服务端使用）

## Architecture

### 页面路由

| 路径 | 功能 | 数据源 |
|------|------|--------|
| `/` | Explore - 社区图库 | `subscribeToAllImages()` |
| `/create` | 图片生成 | POST `/api/generate` |
| `/organize` | 我的图库管理 | `subscribeToAllImages()` |
| `/login` | 登录 | Firebase Auth |

### 核心数据流

```
用户输入 → /api/generate → SeeDream API → 返回临时 URL (24h)
                                              ↓
                                   上传 Firebase Storage（永久）
                                              ↓
                                   写入 Firestore（imageUrl + originalUrl）
                                              ↓
                                   onSnapshot 实时更新 UI
```

### API Routes (`app/api/`)

- `generate/route.ts` - 代理 SeeDream API，注入 `ARK_API_KEY`
- `save-image/route.ts` - 上传图片到 Firebase Storage
- `submit-task/route.ts` - 提交生成任务到队列

### Firestore Collections

**images** - 图片记录
```typescript
{
  userId: string,      // Firebase UID
  userName: string,
  prompt: string,
  imageUrl: string,    // Firebase Storage URL（永久）
  originalUrl: string, // SeeDream API URL（24h 有效）
  size: string,
  mode: 'text' | 'image' | 'multi',
  liked: boolean,
  deleted: boolean,    // 软删除
  createdAt: Timestamp
}
```

**tasks** - 生成任务
```typescript
{
  userId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  prompt: string,
  images: TaskImage[],
  createdAt: number
}
```

### 关键模式

**实时订阅** (`lib/firestore.ts`):
- `subscribeToAllImages()` - 所有未删除图片，按时间倒序
- `subscribeToUserImages()` - 指定用户的图片
- 查询条件 `where('deleted', '==', false)` + `orderBy('createdAt', 'desc')`

**认证状态** (`contexts/AuthContext.tsx`):
- `useAuth()` 返回 `{ user, loading, signInWithGoogle, signOut }`
- 页面不应等待 `authLoading` 才加载数据（影响首屏渲染）

**响应式布局**:
- 断点 `md` (768px) 分界桌面/移动端
- 桌面: `Sidebar` 固定 256px
- 移动: `MobileNav` 汉堡菜单

### UI 组件

使用 shadcn/ui（基于 Radix UI）+ Tailwind CSS v4。

已安装组件: `button`, `avatar`, `dialog`, `dropdown-menu`, `slider`, `tabs`

## Deployment

**线上地址**: https://seedream-gallery.web.app

Firebase 配置:
- Project ID: `seedream-gallery`
- Region: `asia-east1`
- Node: 24

**注意**: `tsconfig.json` 中需排除 `mcp/` 目录，否则 Next.js 会尝试编译 MCP Server 代码。
