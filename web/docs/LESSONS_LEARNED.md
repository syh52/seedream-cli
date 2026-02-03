# Lessons Learned - SeeDream 图片生成系统

本文档记录在开发和维护 SeeDream 图片生成系统过程中遇到的问题、根本原因和解决方案，以防止未来犯同样的错误。

---

## 2026-01-30: MCP 与 Cloud Function 任务处理竞争

### 问题现象

用户报告：无论是使用 MCP 还是在 Web App 上直接生成图片，都会一直显示"生成中"状态，图片永远加载不出来（转圈圈）。

### 排查过程

1. **初始假设**：MCP Server 问题
   - 检查了 MCP 的 submit.ts 代码
   - 发现 MCP 使用 `setImmediate()` 在后台处理任务

2. **Cloud Function 日志分析**：
   ```
   [TaskWorker] Task mcp_xxx already being processed
   ```
   - 所有 `mcp_` 开头的任务都显示 "already being processed"
   - 说明 Cloud Function 检测到任务已被其他进程处理

3. **关键发现**：
   - MCP 创建任务后自己后台处理，但处理失败（可能是 OOM 或网络问题）
   - Cloud Function 检测到任务状态不是 `pending`，跳过处理
   - 任务卡在 `generating` 状态，永远无法完成

4. **验证 Cloud Function**：
   - 用 Admin SDK 直接创建测试任务
   - Cloud Function 成功处理，确认其本身正常工作

### 根本原因

```
架构设计缺陷：MCP 和 Cloud Function 竞争处理同一任务

时序图：
1. MCP 创建任务 (status='pending')
2. MCP 后台开始处理，更新 status='generating'
3. Cloud Function 被触发 (onDocumentCreated)
4. Cloud Function 检查 status != 'pending'，跳过
5. MCP 后台处理失败（OOM/超时/网络）
6. 任务永久卡在 'generating' 状态
```

### 解决方案

**架构重构**：让 MCP 只创建任务，Cloud Function 统一处理

```typescript
// 修改前 (submit.ts)
async (params) => {
  const taskId = generateId();
  setImmediate(() => {
    processTaskWithFirebase(taskId, params); // MCP 自己处理
  });
  return { taskId };
}

// 修改后 (submit.ts)
async (params) => {
  const taskId = generateId();
  await createTaskWithId(taskId, params); // 只创建任务
  // Cloud Function 会自动处理
  return { taskId };
}
```

### 经验教训

1. **避免分布式系统中的任务处理竞争**
   - 同一任务只应由一个处理者负责
   - 使用明确的任务所有权机制

2. **Firestore 触发器的理解**
   - `onDocumentCreated` 只在文档首次创建时触发
   - 更新文档不会触发 `onDocumentCreated`
   - 如需监听更新，使用 `onDocumentWritten`

3. **后台任务的可靠性**
   - `setImmediate()` 不保证任务完成
   - 服务器重启、OOM 会导致后台任务丢失
   - 关键任务应使用持久化的任务队列

4. **日志分析的重要性**
   - "already being processed" 是关键线索
   - 日志中没有 `task-` 前缀的任务表明 Web App 任务正常

### 预防措施

- [ ] MCP 只负责创建任务，不自己处理
- [ ] 所有任务由 Cloud Function 统一处理
- [ ] 添加任务超时机制（自动将超时任务标记为失败）
- [ ] 定期清理卡住的任务

---

## 2026-01-30: Firestore 区域与 Cloud Function 区域

### 问题现象

Firestore 触发器可能有延迟。

### 发现

- Firestore 数据库位置：`nam5`（美国）
- Cloud Function 部署区域：`asia-east1`（亚洲）

### 影响

跨区域触发器可能有额外延迟，但不会导致完全失败。

### 建议

理想情况下，Firestore 和 Cloud Function 应在同一区域或邻近区域：
- 减少延迟
- 提高可靠性
- 降低成本

---

## 2026-01-30: Firestore 不接受 undefined 值

### 问题现象

Firestore 写入失败，错误信息提示 "undefined is not a valid Firestore value"。

### 根本原因

```typescript
// 错误写法
const taskData = {
  id: taskId,
  strength: params.strength, // 可能是 undefined
};
await db.collection('tasks').doc(taskId).set(taskData);
```

### 解决方案

```typescript
// 正确写法 - 条件性包含字段
const taskData: Record<string, unknown> = {
  id: taskId,
  // ... 其他必需字段
};

// 只在有值时才包含
if (params.strength !== undefined) {
  taskData.strength = params.strength;
}
```

### 经验教训

- Firestore 严格区分 `null` 和 `undefined`
- `undefined` 不是有效值，会导致写入失败
- 使用条件性对象展开或显式检查

---

## 2026-01-30: Cloud Function 中的 Prompt 前缀

### 问题现象

生成的图片不符合预期，SeeDream API 生成了变体而不是原始图片。

### 根本原因

Cloud Function 的 `seedreamClient.ts` 在 prompt 前添加了前缀：

```typescript
prompt: `Generate a series of ${expectedCount} variations: ${prompt}`,
```

### 解决方案

使用原始 prompt，不添加前缀：

```typescript
prompt: prompt, // 直接使用原始 prompt
```

### 经验教训

- SeeDream API 从 prompt 内容自动理解意图
- 不需要显式指示生成"变体"
- 额外的前缀可能改变生成结果的语义

---

## 2026-01-30: MCP Server OOM (Out of Memory)

### 问题现象

Railway 上的 MCP Server 频繁崩溃。

### 根本原因

```typescript
const CONFIG = {
  MAX_PARALLEL_API_CALLS: 8,    // 太高
  MAX_PARALLEL_DOWNLOADS: 8,    // 太高
};
```

每个 API 调用和下载都消耗内存，8 个并行操作超出了 Railway 512MB 的内存限制。

### 解决方案

```typescript
const CONFIG = {
  MAX_PARALLEL_API_CALLS: 2,    // 降低并发
  MAX_PARALLEL_DOWNLOADS: 4,    // 降低并发
};
```

### 经验教训

- 云服务有内存限制（Railway 免费版 512MB）
- 图片处理是内存密集型操作
- 并发数应根据可用资源调整
- 使用流式处理减少内存峰值

---

## 调试技巧

### 1. 验证 Cloud Function 是否工作

```bash
# 创建测试任务
npx tsx scripts/test-task.ts

# 检查日志
firebase functions:log --only processGenerationTask -n 20
```

### 2. 检查用户任务状态

```typescript
const snapshot = await db.collection('tasks')
  .where('userId', '==', userId)
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();

snapshot.docs.forEach(doc => {
  console.log(doc.id, doc.data().status, doc.data().images?.length);
});
```

### 3. 清理卡住的任务

```typescript
const batch = db.batch();
snapshot.docs.forEach(doc => {
  if (doc.data().status === 'generating' && doc.data().images?.length === 0) {
    batch.delete(doc.ref);
  }
});
await batch.commit();
```

### 4. 检查 Firestore 区域

```bash
firebase firestore:databases:get "(default)"
```

---

## 架构决策记录

### ADR-001: 任务处理统一由 Cloud Function 负责

**背景**：MCP Server 和 Cloud Function 都可以处理任务，导致竞争条件。

**决策**：所有任务处理统一由 Cloud Function 负责，MCP 只创建任务。

**原因**：
1. Cloud Function 有更高的可靠性（Google 基础设施）
2. 避免竞争条件
3. 简化代码维护
4. MCP Server 资源有限（512MB）

**后果**：
- MCP `seedream_submit` 工具响应更快（只创建任务）
- 所有任务有统一的处理逻辑
- 依赖 Cloud Function 的可用性

---

## 检查清单

### 部署前检查

- [ ] Firestore 规则是否允许任务创建
- [ ] Cloud Function 是否有 ARK_API_KEY Secret
- [ ] MCP Server 是否有 Firebase 凭证
- [ ] 并发配置是否适合目标环境的内存限制

### 故障排查检查

- [ ] 检查 Cloud Function 日志
- [ ] 检查任务状态（pending/generating/completed/failed）
- [ ] 检查 images 数组是否有数据
- [ ] 确认 Firestore 区域和 Cloud Function 区域
- [ ] 检查 ARK_API_KEY 是否有效

---

## 2026-01-30: Firestore 并行更新竞态条件

### 问题现象

请求生成 4 张图片，但任务完成后只有 1 张图片被保存到 Firestore。

### 根本原因

Cloud Function 在 `onImageGenerated` 回调中并行更新 Firestore 的图片数组：

```typescript
// 错误写法：多个并行回调同时读写同一个数组
async (generatedImage: GeneratedImage) => {
  const taskDoc = await taskRef.get()
  const currentImages = (taskDoc.data()?.images || []) as TaskImage[]
  currentImages[index] = updatedImage  // 基于旧数据更新
  await taskRef.update({ images: currentImages })  // 覆盖其他回调的更改！
}
```

竞态条件时序：
1. 回调 A 和回调 B 同时读取 `images = [pending, pending, pending, pending]`
2. 回调 A 设置 `images[0] = ready`，保存 `[ready, pending, pending, pending]`
3. 回调 B 设置 `images[1] = ready`，但它基于旧数据，保存 `[pending, ready, pending, pending]`
4. 回调 B 覆盖了回调 A 的更改！

### 解决方案

收集所有生成的图片，在 API 调用完成后一次性批量更新：

```typescript
// 正确写法：收集数据，最后一次性更新
const generatedImages: Map<number, GeneratedImage> = new Map()

await generateImages(params, apiKey, async (img) => {
  generatedImages.set(img.index, img)  // 只收集，不更新 Firestore
})

// 所有图片生成后，并行上传 Storage
const uploadPromises = Array.from(generatedImages).map(...)
await Promise.all(uploadPromises)

// 一次性更新 Firestore（避免竞态条件）
await taskRef.update({ images: finalImages })
```

### 经验教训

1. **Firestore 数组更新不是原子操作**
   - 读取-修改-写入模式在并发环境下不安全
   - 使用 `FieldValue.arrayUnion()` 或一次性批量更新

2. **并行回调中的状态更新**
   - 避免在并行回调中更新共享状态
   - 收集数据后统一处理

3. **日志分析**
   - `imageCount: 4` 说明 API 成功了
   - 但 Firestore 只有 1 张，说明是保存逻辑问题

---

## 2026-01-30: SeeDream API 批量生成策略

### 问题现象

使用 `sequential_image_generation: 'auto'` 请求生成 4 张图片，但 API 只返回 1 张。

### 根本原因

`sequential_image_generation: 'auto'` 让 API 自动决定生成数量，不保证生成指定数量的图片。

### 解决方案

改为为每张图片独立发起 API 调用（并行执行）：

```typescript
// 正确策略：为每张图片独立调用 API
const numCalls = expectedCount
const MAX_CONCURRENT = 2  // 限制并发避免超时

for (let i = 0; i < numCalls; i++) {
  const task = generateSingleImage(payload, apiKey, i)
  tasks.push(task)

  if (tasks.length >= MAX_CONCURRENT) {
    await Promise.all(tasks)
    tasks.length = 0
  }
}
```

### 经验教训

- `auto` 模式不可靠，可能只返回 1 张
- 为每张图片独立调用 API 更可控
- 限制并发数（2）避免 Cloud Function 超时

---

*最后更新：2026-01-30*
