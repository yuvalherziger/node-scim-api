import axios from "axios";
import * as fs from "node:fs";

const SCIM_TESTER_BASE_URL = process.env.SCIM_TESTER_BASE_URL || "http://localhost:8081";
const SCIM_SERVER_BASE_URL = process.env.SCIM_SERVER_BASE_URL || "http://localhost:3999";
const SCIM_BEARER_TOKEN = process.env.SCIM_BEARER_TOKEN || "";

console.log('[SCIM-CT] Config:', {
  testerBaseUrl: SCIM_TESTER_BASE_URL,
  serverBaseUrl: SCIM_SERVER_BASE_URL,
  hasBearerToken: Boolean(SCIM_BEARER_TOKEN),
  time: new Date().toISOString(),
});

const MAX_ATTEMPTS = 30;

const expectedTestedActionSuccess = {
  "ServiceProviderConfig": true,
  "ResourceTypes": true,
  "Schemas": true,
  "Create new User": true,
  "Read a User": true,
  "List User": true,
  "Search Filter Users": true,
  "Update User": true,
  "Patch User": true,
  "Delete User": true,
  "Create new Group": true,
  "Read a Group": true,
  "List Group": true,
  "Search Filter Groups": true,
  "Update Group": true,
  "Patch Group": true,
  "Delete Group": true,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertSuccess(action) {
  const { title, success } = action;
  console.log('[SCIM-CT] Asserting action:', { title, success });
  const expected = expectedTestedActionSuccess[title];
  if (!expected === success) {
    throw new Error(`Expected '${title}' to be ${expected ? 'successful' : 'failed'}`);
  }
}

async function runTests() {
  // Start the test run using axios with URL-encoded body
  const params = new URLSearchParams();
  params.set('endPoint', SCIM_SERVER_BASE_URL);
  params.set('username', '');
  params.set('password', '');
  params.set('jwtToken', SCIM_BEARER_TOKEN);
  params.set('usersCheck', '1');
  params.set('groupsCheck', '1');
  params.set('checkIndResLocation', '1');

  const startUrl = `${SCIM_TESTER_BASE_URL}/test/run`;
  console.log('[SCIM-CT] Starting test run:', {
    startUrl,
    serverBaseUrl: SCIM_SERVER_BASE_URL,
    hasBearerToken: Boolean(SCIM_BEARER_TOKEN),
    time: new Date().toISOString(),
  });
  const startResp = await axios.post(startUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    validateStatus: () => true,
  });
  console.log('[SCIM-CT] Start response:', {
    status: startResp.status,
    dataKeys: startResp && startResp.data ? Object.keys(startResp.data) : null,
    rawId: startResp && startResp.data ? startResp.data.id : undefined,
  });

  if (startResp.status < 200 || startResp.status >= 300) {
    console.error('[SCIM-CT] Failed to start test run. HTTP status:', startResp.status);
    throw new Error(`Failed to start test run: HTTP ${startResp.status}`);
  }
  const runId = startResp?.data?.id;
  console.log('[SCIM-CT] Obtained runId:', runId);
  if (typeof runId !== 'string' || !runId) {
    console.error('[SCIM-CT] Missing or invalid runId in /test/run response:', startResp.data);
    throw new Error('Failed to obtain run id from /test/run response');
  }

  // Poll for status every second up to 60 times
  const statusUrl = `${SCIM_TESTER_BASE_URL}/test/status`;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    console.log(`[SCIM-CT] Polling attempt ${attempt + 1}/${MAX_ATTEMPTS} @ ${new Date().toISOString()}`);
    let resp;
    try {
      resp = await axios.get(statusUrl, {
        params: { runId, lastIndex: 0 },
        validateStatus: () => true,
      });
    } catch (e) {
      console.error('[SCIM-CT] Polling request failed (network/transport error):', e && e.message ? e.message : e);
      console.log('[SCIM-CT] Will retry after 1s...');
      await sleep(1000);
      continue;
    }
    console.log('[SCIM-CT] Status response:', {
      status: resp.status,
      dataType: resp && resp.data ? typeof resp.data : null,
      dataKeys: resp && resp.data && typeof resp.data === 'object' ? Object.keys(resp.data) : null,
    });

    if (
      resp.status === 200 &&
      resp && typeof resp.data === 'object' && resp.data !== null &&
      Object.prototype.hasOwnProperty.call(resp.data, 'data') &&
      Array.isArray(resp.data.data) &&
      resp.data.data.length >= Object.keys(expectedTestedActionSuccess).length
    ) {
      console.log('[SCIM-CT] Valid status payload received. Items:', resp.data.data.length);
      for (const item of resp.data.data) {
        await assertSuccess(item);
      }
      return resp.data.data;
    }

    // console.log(JSON.stringify(resp.data.data.filter(i => i.success === false && i.exception).map(i => ({exception: i.exception}))[0], null, 2));
    console.log('[SCIM-CT] Status payload not ready yet. Sleeping 1s before next poll...');
    await sleep(1000);
  }

  console.error(`[SCIM-CT] Polling for test status timed out after ${MAX_ATTEMPTS} seconds`);
  printLog('/tmp/scim2-compliance.log');
  throw new Error(`Polling for test status timed out after ${MAX_ATTEMPTS} seconds`);
}

function printLog(logPath) {
  if (!logPath) return;
  try {
    const log = fs.readFileSync(logPath, 'utf8');
    console.log(log);
  } catch (e) {
    console.error('Failed to read log file:', e && e.message ? e.message : e);
  }
}

runTests().then(res => {
  console.log('Compliance test completed. Items:', res.length);
  process.exit(0);
}).catch(err => {
  console.error('Compliance test failed:', err && err.message ? err.message : err);
  process.exit(1);
});
