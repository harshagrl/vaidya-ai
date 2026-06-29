/**
 * End-to-end test script for the full flow:
 *   1. Register a test user
 *   2. Get the auto-created "Self" profile
 *   3. Save a prescription record (triggers background embedding)
 *   4. Wait for embeddings to complete
 *   5. Chat: grounding question (should match KB or personal record)
 *   6. Chat: unrelated question (should trigger fallback)
 */
require('dotenv').config();

const BASE = 'http://localhost:5000/api';
const TEST_EMAIL = `e2e_test_${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  
  const data = await res.json();
  return { status: res.status, data };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('=== E2E TEST START ===\n');

  // 1. Register
  console.log('1. Registering test user:', TEST_EMAIL);
  const reg = await request('POST', '/auth/register', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    firstName: 'TestUser',
    lastName: 'E2E'
  });
  if (!reg.data.token) {
    console.error('REGISTER FAILED:', reg.data);
    process.exit(1);
  }
  const token = reg.data.token;
  console.log('   ✅ Token received\n');

  // 2. Get profiles (auto-created "Self")
  console.log('2. Fetching profiles...');
  const profiles = await request('GET', '/profiles', null, token);
  if (!profiles.data.data || profiles.data.data.length === 0) {
    console.error('NO PROFILES:', profiles.data);
    process.exit(1);
  }
  const profileId = profiles.data.data[0]._id;
  console.log(`   ✅ Profile ID: ${profileId}\n`);

  // 3. Create a prescription record (this triggers background embedding)
  console.log('3. Creating a prescription record (Dolo 650)...');
  const record = await request('POST', `/profiles/${profileId}/records`, {
    type: 'PRESCRIPTION',
    sourceImageUrl: 'https://example.com/test-prescription.jpg',
    prescribedDate: '2026-06-20T00:00:00.000Z',
    prescribingDoctor: 'Dr. Sharma',
    medicines: [
      {
        medicineName: 'Dolo 650',
        dosage: '650mg',
        frequency: '1-0-1',
        duration: '5 days',
        doctorNotes: 'Take after food'
      }
    ]
  }, token);
  console.log(`   Status: ${record.status}`);
  if (record.status === 409) {
    // Interaction check triggered — acknowledge and retry
    console.log('   ⚠️ Interactions detected, acknowledging and retrying...');
    const retryRecord = await request('POST', `/profiles/${profileId}/records`, {
      type: 'PRESCRIPTION',
      sourceImageUrl: 'https://example.com/test-prescription.jpg',
      prescribedDate: '2026-06-20T00:00:00.000Z',
      prescribingDoctor: 'Dr. Sharma',
      medicines: [
        {
          medicineName: 'Dolo 650',
          dosage: '650mg',
          frequency: '1-0-1',
          duration: '5 days',
          doctorNotes: 'Take after food'
        }
      ],
      acknowledgedInteractions: record.data.interactions
    }, token);
    console.log(`   Retry status: ${retryRecord.status}`);
    console.log(`   ✅ Record saved: ${retryRecord.data.data?._id}\n`);
  } else if (record.status === 201) {
    console.log(`   ✅ Record saved: ${record.data.data?._id}\n`);
  } else {
    console.error('   ❌ RECORD CREATION FAILED:', record.data);
    process.exit(1);
  }

  // 4. Wait for background embedding to complete
  console.log('4. Waiting 8s for background embeddings to complete...');
  await sleep(8000);
  console.log('   ✅ Done waiting\n');

  // 5. Chat: grounding question (should match the KB entry for Dolo 650 / Paracetamol)
  console.log('5. Chat: Grounding question — "What is Dolo 650 used for?"');
  const chatGround = await request('POST', `/profiles/${profileId}/chat`, {
    message: 'What is Dolo 650 used for?'
  }, token);
  console.log(`   Status: ${chatGround.status}`);
  console.log(`   Response: ${chatGround.data.response}`);
  console.log(`   Success: ${chatGround.data.success}`);
  if (chatGround.data.success) {
    const isGrounded = chatGround.data.response !== "I cannot answer that based on the provided health records. Please consult a doctor for medical advice.";
    console.log(`   ✅ Grounded: ${isGrounded}\n`);
  } else {
    console.log(`   ❌ Chat failed: ${chatGround.data.message}\n`);
  }

  // 6. Chat: unrelated question (should trigger fallback via GROUNDING_THRESHOLD)
  console.log('6. Chat: Fallback question — "What is the GDP of France?"');
  const chatFallback = await request('POST', `/profiles/${profileId}/chat`, {
    message: 'What is the GDP of France?'
  }, token);
  console.log(`   Status: ${chatFallback.status}`);
  console.log(`   Response: ${chatFallback.data.response}`);
  console.log(`   Success: ${chatFallback.data.success}`);
  const isFallback = chatFallback.data.response === "I cannot answer that based on the provided health records. Please consult a doctor for medical advice.";
  console.log(`   ✅ Fallback triggered: ${isFallback}\n`);

  console.log('=== E2E TEST COMPLETE ===');
  process.exit(0);
}

run().catch(err => {
  console.error('E2E TEST CRASH:', err);
  process.exit(1);
});
