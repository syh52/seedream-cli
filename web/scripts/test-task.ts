/**
 * Test script to create a task directly in Firestore
 * This helps verify if Cloud Function is working correctly
 *
 * Run: npx tsx scripts/test-task.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load service account
const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(process.env.HOME || '', '.firebase/seedream-gallery-firebase-adminsdk-fbsvc-41732fbd28.json');

if (!fs.existsSync(saPath)) {
  console.error('Service account not found:', saPath);
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS env var');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf-8'));

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

async function createTestTask() {
  const taskId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = process.env.FIREBASE_USER_ID || '5Rpcgioc1KVzitEezOwWoLQPqbz1';

  console.log('Creating test task:', taskId);
  console.log('User ID:', userId);

  const taskData = {
    id: taskId,
    userId,
    userName: 'Test User',
    status: 'pending',
    prompt: 'Test task - a beautiful sunset over mountains',
    mode: 'text',
    size: '2K',
    expectedCount: 1,
    images: [],
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: 2,
  };

  await db.collection('tasks').doc(taskId).set(taskData);
  console.log('Task created successfully!');
  console.log('');
  console.log('Check Cloud Function logs in 30 seconds:');
  console.log('  firebase functions:log --only processGenerationTask -n 20');
  console.log('');
  console.log('Or check Firestore for task status:');
  console.log(`  Task ID: ${taskId}`);

  // Wait and check status
  console.log('\nWaiting 30 seconds to check status...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  const taskDoc = await db.collection('tasks').doc(taskId).get();
  const task = taskDoc.data();
  console.log('\nTask status after 30s:', task?.status);
  console.log('Images:', task?.images?.length || 0);

  if (task?.status === 'pending') {
    console.log('\n❌ Task still pending - Cloud Function NOT triggered!');
  } else if (task?.status === 'processing' || task?.status === 'generating') {
    console.log('\n⏳ Task is processing...');
  } else if (task?.status === 'completed') {
    console.log('\n✅ Task completed successfully!');
  } else if (task?.status === 'failed') {
    console.log('\n❌ Task failed:', task?.error);
  }
}

createTestTask().catch(console.error);
