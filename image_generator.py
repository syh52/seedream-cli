#!/usr/bin/env python3
"""
BytePlus Ark 图像生成脚本
支持三种模式：纯文本生成、单图参考、多图参考
"""

import os
import sys
from byteplussdkarkruntime import Ark
from byteplussdkarkruntime.types.images.images import SequentialImageGenerationOptions


def create_client():
    """创建 Ark 客户端"""
    api_key = os.environ.get("ARK_API_KEY")
    if not api_key:
        print("错误: 请设置环境变量 ARK_API_KEY")
        sys.exit(1)

    return Ark(
        base_url="https://ark.ap-southeast.bytepluses.com/api/v3",
        api_key=api_key,
    )


def handle_stream_response(response):
    """处理流式响应"""
    urls = []
    for event in response:
        if event is None:
            continue

        if event.type == "image_generation.partial_failed":
            print(f"生成失败: {event.error}")
            if event.error is not None and event.error.code == "InternalServiceError":
                break

        elif event.type == "image_generation.partial_succeeded":
            if event.error is None and event.url:
                print(f"图片生成成功 - 尺寸: {event.size}, URL: {event.url}")
                urls.append(event.url)

        elif event.type == "image_generation.completed":
            if event.error is None:
                print(f"\n全部完成! 使用量: {event.usage}")

    return urls


def example_text_to_image(client):
    """示例1: 纯文本生成图像 - 四季庭院"""
    print("\n=== 示例1: 四季庭院插图 ===\n")

    response = client.images.generate(
        model="ep-20260123220136-f8bx7",
        prompt="Generate a series of 4 coherent illustrations focusing on the same corner of a courtyard across the four seasons, presented in a unified style that captures the unique colors, elements, and atmosphere of each season.",
        sequential_image_generation="auto",
        sequential_image_generation_options=SequentialImageGenerationOptions(max_images=4),
        response_format="url",
        size="2K",
        stream=True,
        watermark=True
    )

    return handle_stream_response(response)


def example_single_image_reference(client):
    """示例2: 单图参考 - 品牌视觉设计"""
    print("\n=== 示例2: 品牌视觉设计系统 ===\n")

    response = client.images.generate(
        model="ep-20260123220136-f8bx7",
        prompt="Using this LOGO as a reference, create a visual design system for an outdoor sports brand named GREEN, including packaging bags, hats, paper boxes, wristbands, lanyards, etc. Main visual tone is green, with a fun, simple, and modern style.",
        image="https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seedream4_imageToimages.png",
        sequential_image_generation="auto",
        sequential_image_generation_options=SequentialImageGenerationOptions(max_images=5),
        response_format="url",
        size="2K",
        stream=True,
        watermark=True
    )

    return handle_stream_response(response)


def example_multi_image_reference(client):
    """示例3: 多图参考 - 游乐园场景"""
    print("\n=== 示例3: 游乐园过山车场景 ===\n")

    response = client.images.generate(
        model="ep-20260123220136-f8bx7",
        prompt="Generate 3 images of a girl and a cow plushie happily riding a roller coaster in an amusement park, depicting morning, noon, and night.",
        image=[
            "https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seedream4_imagesToimages_1.png",
            "https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seedream4_imagesToimages_2.png"
        ],
        sequential_image_generation="auto",
        sequential_image_generation_options=SequentialImageGenerationOptions(max_images=3),
        response_format="url",
        size="2K",
        stream=True,
        watermark=True
    )

    return handle_stream_response(response)


def main():
    """主函数"""
    print("BytePlus Ark 图像生成器")
    print("=" * 40)
    print("1. 四季庭院插图 (纯文本生成)")
    print("2. 品牌视觉设计 (单图参考)")
    print("3. 游乐园场景 (多图参考)")
    print("0. 退出")
    print("=" * 40)

    choice = input("\n请选择示例 (0-3): ").strip()

    if choice == "0":
        print("再见!")
        return

    client = create_client()

    examples = {
        "1": example_text_to_image,
        "2": example_single_image_reference,
        "3": example_multi_image_reference,
    }

    if choice in examples:
        urls = examples[choice](client)
        if urls:
            print(f"\n共生成 {len(urls)} 张图片")
    else:
        print("无效选择")


if __name__ == "__main__":
    main()
