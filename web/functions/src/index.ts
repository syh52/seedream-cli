/**
 * Firebase Cloud Functions 入口文件
 * SeeDream 图片生成后台任务处理
 */

import * as admin from 'firebase-admin'

// 初始化 Firebase Admin SDK
admin.initializeApp()

// 导出 Cloud Functions
export { processGenerationTask } from './taskWorker'
