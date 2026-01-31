# Seedream 4.5 知识库

> 本文档整理自 BytePlus ModelArk 官方文档，用于帮助创建图片生成 Web App

---

## 目录

1. [概述](#概述)
2. [模型选择](#模型选择)
3. [API 调用](#api-调用)
4. [功能模式](#功能模式)
5. [提示词指南](#提示词指南)
6. [图像输出配置](#图像输出配置)
7. [使用限制](#使用限制)
8. [代码示例](#代码示例)

---

## 概述

Seedream 4.5 和 4.0 是 ByteDance 推出的先进图像生成模型，原生支持：

- **文本输入** (Text-to-Image)
- **单图输入** (Image-to-Image)
- **多图输入** (Multi-Image Input)

支持的工作流程：
- 基于主题一致性的多图融合
- 图像编辑
- 批量图像生成
- 风格迁移
- 虚拟试穿
- 草图/线框图转高保真图像

---

## 模型选择

### Seedream 4.5 (推荐)

| 属性 | 值 |
|------|-----|
| Model ID | `seedream-4-5-251128` |
| 版本 | 251128 |
| 特点 | 最新最先进，高质量图像生成 |

**优势：**
- 更强的编辑一致性（保持主题细节、光线、色调）
- 增强的人像细化和小文本生成
- 显著增强的多图像合成能力
- 优化的推理和视觉美学
- 仅支持 `standard` 优化模式

### Seedream 4.0

| 属性 | 值 |
|------|-----|
| Model ID | `seedream-4-0-250828` |
| 版本 | 250828 |
| 特点 | 平衡成本和输出质量 |

**优势：**
- 适合一般图像生成场景
- 支持 `fast` 优化模式（更快生成速度，略低质量）

---

## API 调用

### 基础信息

| 项目 | 值 |
|------|-----|
| API 端点 | `POST https://ark.ap-southeast.bytepluses.com/api/v3/images/generations` |
| 认证方式 | API Key (Bearer Token) |
| Content-Type | `application/json` |

### 获取 API Key

访问 API Key 管理页面：`https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey`

### 各模型能力对比

| 模型 | 文生图 | 图生图 | 多图融合 | 批量生成 | 流式输出 |
|------|--------|--------|----------|----------|----------|
| seedream-4.5 | ✅ | ✅ | ✅ (2-14图) | ✅ | ✅ |
| seedream-4.0 | ✅ | ✅ | ✅ (2-14图) | ✅ | ✅ |
| seedream-3.0-t2i | ✅ | ❌ | ❌ | ❌ | ❌ |
| seededit-3.0-i2i | ❌ | ✅ (仅单图) | ❌ | ❌ | ❌ |

### 请求参数详解

#### 必需参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `model` | string | 模型 ID 或推理端点 ID（见下方说明）|
| `prompt` | string | 图像生成的文本提示词。建议保持在 **600 英文单词以内** |

#### Model 参数详解

`model` 参数支持两种形式：

| 类型 | 格式 | 示例 | 说明 |
|------|------|------|------|
| **Model ID** | `模型名-版本号` | `seedream-4-5-251128` | 直接使用模型，采用默认配置 |
| **Endpoint ID** | `ep-` 前缀 | `ep-20260123220136-f8bx7` | 使用自定义推理端点 |

**自定义推理端点 (Inference Endpoint) 的优势：**
- 可配置专属资源和独立速率限制
- 便于成本管理和使用监控
- 适合生产环境部署

**创建和管理端点：**
- 控制台地址：`https://console.byteplus.com/ark/region:ark+ap-southeast-1/endpoint`
- 文档参考：[Get Endpoint ID](https://docs.byteplus.com/en/docs/ModelArk/1099522)

#### 可选参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `image` | string/array | - | 参考图像，支持 Base64 编码或可访问的 URL。Seedream 4.5/4.0 支持 1-14 张图片 |
| `size` | string | `2048x2048` | 输出尺寸（见下方尺寸设置详解）|
| `response_format` | string | `url` | 返回格式：`url`（24小时有效链接）或 `b64_json` |
| `watermark` | boolean | `true` | 是否在右下角添加 "AI generated" 水印 |
| `stream` | boolean | `false` | 是否启用流式输出（仅 4.5/4.0）|
| `sequential_image_generation` | string | `disabled` | 批量生成：`auto`（自动）或 `disabled`（禁用），仅 4.5/4.0 |
| `sequential_image_generation_options` | object | - | 批量生成配置，`max_images` 范围 [1, 15] |
| `seed` | integer | `-1` | 随机种子 [-1, 2147483647]，仅 seedream-3.0 和 seededit-3.0 |
| `guidance_scale` | float | 2.5/5.5 | 提示词遵循程度，仅 seedream-3.0 和 seededit-3.0 |
| `optimize_prompt_options` | object | - | 提示词优化配置（见下方详解）|

#### 图像输入格式

```javascript
// URL 格式
"image": "https://example.com/image.jpg"

// Base64 格式（注意格式必须小写）
"image": "data:image/png;base64,<base64_encoded_data>"

// 多图输入（数组）
"image": ["https://url1.jpg", "https://url2.jpg"]
```

#### 优化提示词选项

```json
{
  "optimize_prompt_options": {
    "mode": "standard"  // "standard"（高质量）或 "fast"（更快，仅 4.0 支持）
  }
}
```

### 响应参数详解

#### 成功响应

```json
{
  "model": "seedream-4-5-251128",
  "created": 1757323224,
  "data": [
    {
      "url": "https://...",
      "size": "1760x2368"
    }
  ],
  "usage": {
    "generated_images": 1,
    "output_tokens": 16384,
    "total_tokens": 16384
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `model` | string | 使用的模型 ID |
| `created` | integer | 请求创建的 Unix 时间戳（秒）|
| `data` | array | 输出图像信息数组 |
| `data[].url` | string | 图像下载链接（`response_format=url` 时返回，**24小时内有效**）|
| `data[].b64_json` | string | Base64 编码的图像数据（`response_format=b64_json` 时返回）|
| `data[].size` | string | 图像尺寸，如 `2048x2048`（仅 4.5/4.0）|
| `data[].error` | object | 单张图片生成失败时的错误信息 |
| `usage.generated_images` | integer | 成功生成的图像数量（计费依据）|
| `usage.output_tokens` | integer | 消耗的输出 token 数 |
| `usage.total_tokens` | integer | 消耗的总 token 数 |

#### Token 计算公式

```
output_tokens = round(sum(image_width × image_height) / 256)
```

#### 错误响应

```json
{
  "error": {
    "code": "InvalidParameter",
    "message": "Error description"
  }
}
```

### 批量生成失败处理

当使用 seedream-4.5/4.0 批量生成图像时：
- **内容过滤拒绝**: 继续生成后续图像，其他图像不受影响
- **内部服务错误 (500)**: 终止后续图像生成任务

---

## 功能模式

### 1. Text-to-Image（文本生成图像）

**用途：** 通过文本描述生成图像

**参数：**
```json
{
  "model": "seedream-4-5-251128",
  "prompt": "你的提示词",
  "size": "2K",
  "watermark": false
}
```

### 2. Image-to-Image（图像编辑）

**用途：** 编辑现有图像，包括添加、删除、替换、修改元素

**参数：**
```json
{
  "model": "seedream-4-5-251128",
  "prompt": "编辑指令",
  "image": "https://your-image-url.jpg",
  "size": "2K"
}
```

**支持的编辑操作：**
- **Addition（添加）:** "Add matching silver earrings and a necklace to the girl"
- **Deletion（删除）:** "Remove the girl's hat"
- **Replacement（替换）:** "Replace the largest bread man with a croissant man"
- **Modification（修改）:** "Turn the robots into transparent crystal, colored red, yellow and green"

**视觉标记支持：**
可以在图片上添加箭头、边界框、涂鸦来指定编辑区域：
- "Insert a TV where **the red area is marked**"
- "Enlarge the title to **match the red box**"

### 3. Multi-Image Blending（多图融合）

**用途：** 混合多张参考图片的风格和元素

**参数：**
```json
{
  "model": "seedream-4-5-251128",
  "prompt": "Replace the clothing in image 1 with the outfit from image 2",
  "image": ["url1", "url2"],
  "sequential_image_generation": "disabled",
  "size": "2K"
}
```

**典型应用：**
- 虚拟试穿："Dress the character in Image 1 with the outfit from Image 2"
- 角色替换："Replace the subject in Image 1 with the subject from Image 2"
- 风格迁移："Apply the style of Image 2 to Image 1"

### 4. Batch Image Output（批量图像生成）

**用途：** 生成一组主题相关的图像

**参数：**
```json
{
  "model": "seedream-4-5-251128",
  "prompt": "Generate a series of 4 coherent illustrations...",
  "sequential_image_generation": "auto",
  "sequential_image_generation_options": {
    "max_images": 4
  },
  "size": "2K"
}
```

**触发批量生成的关键词：**
- "a series"
- "a set"
- "Generate X images..."
- 指定具体数量

### 5. Reference-Based Generation（参考图生成）

**用途：** 从参考图像中提取关键信息（角色、风格、产品特征）

**提示词结构：**
- **Reference Target:** 明确要从参考图中提取的元素
- **Generated Scene Description:** 详细描述生成内容的场景和布局

**示例：**
- 角色参考："Based on the character in the reference image, create an anime figure..."
- 风格参考："Referencing the linear minimalist style of icons, design 9 application icons..."
- 产品参考："Generate four tops in different materials, based on the clothing style worn by the girl"

### 6. Sketch/Wireframe to High-Fidelity（草图转高保真）

**用途：** 将手绘草图、线框图、平面图转换为高保真图像

**最佳实践：**
1. 提供清晰的原始图像
2. 如果图像包含文字，在提示词中说明 "Generate based on the text in the image"
3. 明确主题和需求
4. 指定与参考的关键一致性

**示例：**
```
Based on this floor plan, generate a photorealistic image of a
"modern minimalist furnished living room". The room layout and
furniture placement should exactly match the reference.
```

---

## 提示词指南

### 通用原则

#### 1. 使用自然语言清晰描述场景

**结构：** Subject + Action + Environment

如果美学重要，添加：Style, Color, Lighting, Composition

✅ **推荐：**
> "A girl in a lavish dress walking under a parasol along a tree-lined path, in the style of a Monet oil painting."

❌ **避免：**
> "Girl, umbrella, tree-lined street, oil painting texture."

#### 2. 指定应用场景

明确说明图像的目的和类型。

✅ **推荐：**
> "Design a logo for a gaming company. The logo features a dog playing with a game controller. The company name 'PITBULL' is written on it."

❌ **避免：**
> "An abstract image of a dog holding a controller, and the word PITBULL on it."

#### 3. 增强风格渲染

使用**精确的风格关键词**或**参考图像**：
- "picture book style"
- "children's book illustration style"
- "cinematic photographic feel"

#### 4. 提高文本渲染准确性

对需要出现在图像中的文本使用**双引号**。

✅ **推荐：**
> Generate a poster with the title "Seedream 4.5".

❌ **避免：**
> Generate a poster titled Seedream 4.5.

#### 5. 清晰定义图像编辑目标

使用简洁、明确的指令，避免模糊代词。

✅ **推荐：**
> "Dress the tallest panda in pink Peking Opera costume and headgear, keeping its pose unchanged."

❌ **避免：**
> "Put that one in pink clothes."

### 提示词长度

- 保持在 **600 英文单词以内**
- Seedream 4.5/4.0 对文本有更强的理解能力
- 简洁精确的提示词通常比堆叠华丽复杂的词汇更好

### 高级提示词示例

#### 复杂场景描述

```
A cluttered office desk. On the desk, there is an open laptop
with a screen displaying green code. Next to it, a mug with the
word "Developer" on it, with steam rising from the top. An open
book lies on the desk, with pages showing a Venn diagram. A
sticky note with a mind map drawn on it, organized in a
three-level vertical structure. The background is a blurred
bookshelf. Sunlight shines from the right side.
```

#### 知识可视化

```
Draw the following system of binary linear equations and the
corresponding solution steps on the blackboard: 5x + 2y = 26;
2x - y = 5.
```

#### 信息图

```
Create an infographic showing the causes of inflation. Each
cause should be presented independently with an icon.
```

---

## 图像输出配置

### 尺寸设置

**方法 1：预设分辨率**

使用预设值，并在提示词中用自然语言描述纵横比、形状或用途，让模型自动决定宽高。

| 值 | 说明 |
|-----|------|
| `1K` | 仅 Seedream 4.0 支持 |
| `2K` | 推荐 |
| `4K` | 高分辨率 |

**方法 2：精确像素尺寸**

格式：`"2048x2048"` 或 `"2048×2048"`

**像素范围限制：**

| 项目 | 值 |
|------|-----|
| 默认值 | `2048x2048` |
| 最小总像素 | 2560×1440 = 3,686,400 |
| 最大总像素 | 4096×4096 = 16,777,216 |
| 纵横比范围 | 1/16 到 16 |

> **注意：** 总像素范围和纵横比范围必须同时满足。总像素是指单张图像宽度×高度的乘积。

**示例：**
- ✅ `3750x1250`：总像素 4,687,500，在范围内；纵横比 3:1，在范围内
- ❌ `1500x1500`：总像素 2,250,000，低于最小值 3,686,400

**推荐尺寸对照表：**

| 纵横比 | 推荐像素尺寸 |
|--------|-------------|
| 1:1 | 2048×2048 |
| 4:3 | 2304×1728 |
| 3:4 | 1728×2304 |
| 16:9 | 2560×1440 |
| 9:16 | 1440×2560 |
| 3:2 | 2496×1664 |
| 2:3 | 1664×2496 |
| 21:9 | 3024×1296 |

### 输出格式

| 值 | 说明 |
|-----|------|
| `url` | 返回图像下载链接（JPEG 格式）|
| `b64_json` | 返回 Base64 编码的图像数据 |

### 水印

```json
{
  "watermark": true  // 在右下角添加 "AI generated" 水印
}
```

### 流式输出

启用流式输出可以在图像生成时立即返回结果：

```json
{
  "stream": true
}
```

**流式事件类型：**
- `image_generation.partial_succeeded` - 单张图片生成成功
- `image_generation.completed` - 全部完成
- `[DONE]` - 结束标志

### 提示词优化模式（仅 4.0）

```json
{
  "optimize_prompt_options": {
    "mode": "fast"  // 或 "standard"
  }
}
```

---

## 使用限制

### 输入图像限制

| 限制项 | Seedream 4.5/4.0 | seededit-3.0-i2i |
|--------|------------------|------------------|
| 支持格式 | JPEG, PNG, WEBP, BMP, TIFF, GIF | JPEG, PNG |
| 纵横比 | 1/16 到 16 | 1/3 到 3 |
| 最小尺寸 | 宽度和高度 > 14 px | 宽度和高度 > 14 px |
| 最大大小 | 10 MB | 10 MB |
| 最大像素 | 6000×6000 = 36,000,000 | 6000×6000 = 36,000,000 |
| 最大参考图数量 | 14 张 | 1 张 |

> **注意：** `seedream-3.0-t2i` 不支持图像输入参数。

### 数据保留

- 任务数据（状态、URL 等）保留 **24 小时**
- 过期后自动清除
- 请及时保存生成的图像

### 速率限制

- RPM（每分钟请求数）限制因模型版本而异
- 超出限制会返回错误

---

## 代码示例

### Python SDK

```python
import os
from byteplussdkarkruntime import Ark

# 初始化客户端
client = Ark(
    base_url="https://ark.ap-southeast.bytepluses.com/api/v3",
    api_key=os.getenv('ARK_API_KEY'),
)

# Text-to-Image
response = client.images.generate(
    model="seedream-4-5-251128",
    prompt="A beautiful sunset over the ocean, golden hour lighting",
    size="2K",
    response_format="url",
    watermark=False
)

print(response.data[0].url)
```

### cURL

```bash
curl https://ark.ap-southeast.bytepluses.com/api/v3/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -d '{
    "model": "seedream-4-5-251128",
    "prompt": "Vibrant close-up editorial portrait, model with piercing gaze, wearing a sculptural hat, rich color blocking, sharp focus on eyes, shallow depth of field, Vogue magazine cover aesthetic, shot on medium format, dramatic studio lighting.",
    "size": "2K",
    "response_format": "url",
    "watermark": false
  }'
```

**响应示例：**

```json
{
  "model": "seedream-4-5-251128",
  "created": 1757323224,
  "data": [
    {
      "url": "https://...",
      "size": "1760x2368"
    }
  ],
  "usage": {
    "generated_images": 1,
    "output_tokens": 16384,
    "total_tokens": 16384
  }
}
```

### Image-to-Image 示例

```python
response = client.images.generate(
    model="seedream-4-5-251128",
    prompt="Add sunglasses to the person in the image",
    image="https://your-image-url.jpg",
    size="2K",
    response_format="url",
    watermark=False
)
```

### Multi-Image 示例

```python
response = client.images.generate(
    model="seedream-4-5-251128",
    prompt="Replace the clothing in image 1 with the outfit from image 2",
    image=["https://person-image.jpg", "https://clothing-image.jpg"],
    sequential_image_generation="disabled",
    size="2K",
    response_format="url"
)
```

### 批量生成示例

```python
response = client.images.generate(
    model="seedream-4-5-251128",
    prompt="Generate 4 seasonal illustrations of the same courtyard",
    sequential_image_generation="auto",
    sequential_image_generation_options={
        "max_images": 4
    },
    size="2K",
    stream=False,
    response_format="url"
)

for image in response.data:
    print(image.url)
```

---

## 附录：常用提示词模板

### 人物肖像

```
Vibrant close-up editorial portrait, model with piercing gaze,
wearing a sculptural hat, rich color blocking, sharp focus on eyes,
shallow depth of field, Vogue magazine cover aesthetic, shot on
medium format, dramatic studio lighting.
```

### 产品设计

```
Based on this logo, create a set of visual designs for an outdoor
sports brand named "GREEN". The products include packaging bags,
hats, cards, wristbands, cartons, lanyards. The main visual color
is green, with a simple and modern style.
```

### 故事板

```
Generate four film storyboard images, corresponding to the following
scenes: [场景1], [场景2], [场景3], [场景4]. Maintain consistent
character design and visual style across all frames.
```

### UI 原型转换

```
This is a hand-drawn wireframe of a web-based [应用类型]. Please
render it into a high-fidelity UI interface according to the
textual annotations in the sketch. Add sample images and content
where indicated.
```

### 室内设计

```
Based on this floor plan, generate a photorealistic image of a
"[风格] furnished [房间类型]". The room layout and furniture
placement should exactly match the reference. Use a [色调] color
palette. The room should appear spacious and three-dimensional.
```

---

## 参考链接

- [Image Generation API (Seedream 4.0-4.5)](https://docs.byteplus.com/en/docs/ModelArk/1541523) - API 详细参考
- [Seedream 4.0-4.5 Tutorial](https://docs.byteplus.com/en/docs/ModelArk/1824121) - 使用教程
- [Seedream 4.0-4.5 Prompt Guide](https://docs.byteplus.com/en/docs/ModelArk/1829186) - 提示词指南
- [Streaming Response](https://docs.byteplus.com/en/docs/ModelArk/1824137) - 流式响应文档
- [Model List](https://docs.byteplus.com/en/docs/ModelArk/1330310#image-generation) - 模型列表
- [API Key Management](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey) - API Key 管理
- [Experience Center](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?type=GenImage) - 在线体验
- [Error Codes](https://docs.byteplus.com/en/docs/ModelArk/1299023) - 错误码参考

---

*文档更新日期：2026-01-25*
*数据来源：BytePlus ModelArk 官方文档*
