# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SeeDream Gallery Web App - Next.js 16 **静态导出**应用，提供图像生成和图库浏览功能。使用 Firebase 进行认证和存储。移动优先设计，2 个页面 + 底部 TabBar 导航。

## Commands

```bash
npm run dev     # 开发服务器 http://localhost:3000
npm run build   # 生产构建（静态导出到 out/）
npm run lint    # ESLint 检查

# 部署
npm run build && firebase deploy --only hosting              # 仅前端（~16 秒）
npm run build && firebase deploy --only hosting,functions     # 前端 + Cloud Functions
firebase deploy --only hosting,functions,firestore:rules,storage  # 全量部署

# 添加 UI 组件
npx shadcn@latest add <component>

# 数据迁移（旧 images/tasks → entries）
npx tsx scripts/migrate-to-entries.ts
```

## Environment Variables

复制 `.env.local.example` 到 `.env.local`，填入：
- `NEXT_PUBLIC_FIREBASE_*` - Firebase 客户端配置

注意：Web App 不再需要 `ARK_API_KEY`，API 密钥仅在 Cloud Functions 中使用（作为 Firebase Secret）。

## Architecture

### 静态导出 + 客户端直写

Web App 使用 `output: 'export'` 模式，构建产物为纯静态 HTML/JS/CSS（~2MB），部署到 Firebase Hosting。**没有 API Routes，没有服务端渲染**。

所有数据操作通过客户端 Firebase SDK 直接完成：
- Firestore 读写（受 Security Rules 保护）
- Storage 上传（参考图片）
- Auth 认证

### 图片优化

使用 `wsrv.nl` 作为外部图片代理/CDN（`src/lib/imageLoader.ts`）：
- 静态导出无法使用 Next.js 内置图片优化（无服务端）
- 自定义 loader 通过 URL 参数请求指定宽度 + WebP 格式
- Gallery 图片 sizes: `(min-width: 768px) 25vw, 50vw`
- 缩略图固定 sizes: `48px`, `40px`

### 页面路由

| 路径 | 功能 | 数据源 |
|------|------|--------|
| `/` | Gallery - 图库浏览 (All/Liked) | `subscribeToGallery()` |
| `/create` | 图片生成 + 任务进度 | `subscribeToActiveEntries()` + 客户端直写 Firestore |

导航: 底部 `TabBar` 组件，2 tab (Gallery / Create)

### 核心数据流

```
用户输入 prompt → useCreateEntry() 客户端直写 Firestore → 创建 Entry (status: 'active')
                                                              ↓
                                        Cloud Function (onDocumentCreated) 自动触发
                                                              ↓
                                        调用 SeeDream API → 返回临时 URL (24h)
                                                              ↓
                                        上传 Firebase Storage（永久） + 更新 Entry (status: 'done')
                                                              ↓
                                        onSnapshot 实时更新 UI
```

### Firestore Collection

**entries** - 统一的图片生成记录（合并了旧 `images` + `tasks` Collection）
```typescript
interface Entry {
  id: string               // entry-{timestamp}-{random}
  userId: string           // Firebase UID
  userName: string
  status: 'active' | 'done' | 'failed'   // 3 状态
  prompt: string
  mode: 'text' | 'image' | 'multi'
  size: string             // '3:4', '4:3', '1:1', '16:9', '9:16', '2K', '4K' 等
  strength?: number        // image/multi 模式的参考强度
  images: EntryImage[]     // 嵌入的图片数组
  referenceImageUrls?: string[]
  createdAt: number        // Date.now() 毫秒
  completedAt?: number
  error?: string
  liked: boolean
  deleted: boolean         // 软删除
  source?: 'web' | 'mcp'
  _cf?: {                  // Cloud Function 内部字段
    workerId?: string
    lastHeartbeat?: number
    retryCount?: number
    maxRetries?: number
  }
}

interface EntryImage {
  id: string               // img-0, img-1, ...
  url: string              // Firebase Storage URL（永久）
  originalUrl?: string     // SeeDream API URL（24h 有效）
  width: number
  height: number
  status: 'pending' | 'done' | 'failed'
  error?: string
}
```

### 组件结构

```
src/
├── app/
│   ├── page.tsx                    # Gallery 页面 (All/Liked toggle)
│   ├── create/page.tsx             # Create 页面 (生成 + 进度)
│   └── layout.tsx                  # 根布局 (Providers + TabBar)
├── components/
│   ├── ui/                         # shadcn/ui 组件
│   ├── layout/
│   │   ├── TabBar.tsx              # 底部导航 (Gallery/Create)
│   │   └── GlobalInputBar.tsx      # 全局输入栏
│   ├── shared/
│   │   ├── ImageDetail.tsx         # 图片详情（全屏 + 缩略图条）
│   │   └── BottomSheet.tsx         # 底部弹出菜单
│   ├── create/
│   │   ├── CompactInput.tsx        # 底部输入栏 (prompt + 参考图 + 尺寸)
│   │   ├── EntryCard.tsx           # Entry 卡片 (2x2 图片网格)
│   │   └── PillBadge.tsx           # 参数标签
│   └── Providers.tsx               # AuthProvider + RemixProvider 包装
├── hooks/
│   ├── useEntries.ts               # Gallery 数据订阅
│   └── useCreateEntry.ts           # 客户端直写 Firestore 创建任务
├── lib/
│   ├── firebase.ts                 # Firebase 初始化 (auth, db, storage)
│   ├── firestore.ts                # Firestore CRUD (entries Collection)
│   ├── imageLoader.ts              # wsrv.nl 自定义图片 loader
│   ├── storage.ts                  # Firebase Storage 上传工具
│   └── utils.ts                    # cn() 工具函数
├── contexts/
│   ├── AuthContext.tsx              # Firebase Auth 状态管理
│   └── RemixContext.tsx             # Remix 状态传递
└── types/
    └── index.ts                    # TypeScript 类型定义
```

### 关键模式

**Firestore 操作** (`lib/firestore.ts`):
- `subscribeToGallery(filter, userId, callback)` - Gallery 实时订阅 (all/liked)
- `subscribeToActiveEntries(userId, callback)` - Create 页用户所有未删除 entries
- `createEntry()`, `toggleEntryLike()`, `softDeleteEntry()`, `getEntryById()`

**任务提交** (`hooks/useCreateEntry.ts`):
- 客户端直接写 Firestore（不经过 API Route）
- 参考图片通过客户端 Firebase Storage SDK 上传
- Firestore Security Rules 验证 `userId == auth.uid` 和 `status == 'active'`

**认证状态** (`contexts/AuthContext.tsx`):
- `useAuth()` 返回 `{ user, loading, signInWithGoogle, signOut }`

**响应式布局** (移动优先):
- 底部 TabBar 导航，高度 h-14
- Gallery: `columns-2 md:columns-4` masonry grid
- Create: 水平滚动图片 + 底部固定输入栏

### UI 组件

使用 shadcn/ui（基于 Radix UI）+ Tailwind CSS v4。

已安装组件: `button`, `avatar`, `dialog`, `dropdown-menu`, `slider`, `tabs`

## Deployment

**线上地址**: https://seedream-gallery.firebaseapp.com

Firebase 配置:
- Project ID: `seedream-gallery`
- Region: `asia-east1`
- Node: 24
- Hosting: 纯静态文件（`out/` 目录）

**部署架构**:
- Hosting: 静态 HTML/JS/CSS（`output: 'export'`），SPA rewrites 到 `index.html`
- Cloud Functions: `processGenerationTask`（Firestore trigger，处理图片生成）
- 静态资源缓存: JS/CSS/图片/字体 → `Cache-Control: public, max-age=31536000, immutable`

**注意**: `tsconfig.json` 中需排除 `mcp/` 和 `scripts/` 目录，否则 Next.js 会尝试编译它们导致构建失败。
