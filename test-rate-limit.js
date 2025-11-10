/**
 * Script to test rate limiting implementation
 *
 * This script sends multiple requests to auth endpoints to verify
 * that rate limiting is working correctly.
 *
 * Usage: node test-rate-limit.js
 */

const http = require('http');

const API_BASE_URL = 'http://localhost:3000';
const API_PREFIX = '/api/v1';

// Configuration for tests
const TESTS = {
  login: {
    endpoint: `${API_PREFIX}/auth/login`,
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    data: JSON.stringify({ email: 'test@example.com', password: 'wrongpassword' })
  },
  register: {
    endpoint: `${API_PREFIX}/auth/register`,
    limit: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    data: JSON.stringify({
      email: `test${Date.now()}@example.com`,
      password: 'TestPassword123!'
    })
  },
  verify: {
    endpoint: `${API_PREFIX}/auth/verify`,
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    data: JSON.stringify({})
  }
};

/**
 * Make a POST request to the API
 */
function makeRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Test rate limiting for a specific endpoint
 */
async function testRateLimit(testName, config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Rate Limit: ${testName.toUpperCase()}`);
  console.log(`Endpoint: ${config.endpoint}`);
  console.log(`Expected limit: ${config.limit} requests per ${config.windowMs / 1000 / 60} minutes`);
  console.log(`${'='.repeat(60)}\n`);

  const results = [];

  // Send requests up to limit + 2 to verify rate limiting kicks in
  for (let i = 1; i <= config.limit + 2; i++) {
    try {
      console.log(`Request #${i}...`);
      const result = await makeRequest(config.endpoint, config.data);

      results.push({
        requestNumber: i,
        statusCode: result.statusCode,
        rateLimitLimit: result.headers['ratelimit-limit'],
        rateLimitRemaining: result.headers['ratelimit-remaining'],
        rateLimitReset: result.headers['ratelimit-reset']
      });

      console.log(`  Status: ${result.statusCode}`);
      console.log(`  RateLimit-Limit: ${result.headers['ratelimit-limit']}`);
      console.log(`  RateLimit-Remaining: ${result.headers['ratelimit-remaining']}`);

      if (result.statusCode === 429) {
        console.log(`  ✓ Rate limit triggered at request #${i}`);
        try {
          const body = JSON.parse(result.body);
          console.log(`  Error message: ${body.error}`);
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`  ✗ Error making request:`, error.message);
    }
  }

  // Summary
  console.log(`\n${'-'.repeat(60)}`);
  console.log('Summary:');
  console.log(`  Total requests: ${results.length}`);
  console.log(`  Successful (200-299): ${results.filter(r => r.statusCode >= 200 && r.statusCode < 300).length}`);
  console.log(`  Client errors (400-499): ${results.filter(r => r.statusCode >= 400 && r.statusCode < 500).length}`);
  console.log(`  Rate limited (429): ${results.filter(r => r.statusCode === 429).length}`);

  const firstRateLimited = results.find(r => r.statusCode === 429);
  if (firstRateLimited) {
    console.log(`  ✓ Rate limiting working! Triggered at request #${firstRateLimited.requestNumber}`);
  } else {
    console.log(`  ✗ Warning: No rate limiting detected`);
  }
  console.log(`${'-'.repeat(60)}`);

  return results;
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('RATE LIMITING TEST SUITE');
  console.log('='.repeat(60));
  console.log(`\nServer: ${API_BASE_URL}`);
  console.log('\nMake sure the backend server is running before running this test!');
  console.log('Start the server with: npm run dev\n');

  // Wait a moment before starting
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // Test login endpoint
    await testRateLimit('login', TESTS.login);

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test verify endpoint
    await testRateLimit('verify', TESTS.verify);

    // Note about register endpoint
    console.log(`\n${'='.repeat(60)}`);
    console.log('NOTE: Register endpoint test skipped');
    console.log('To test register rate limiting, run multiple registration');
    console.log('attempts with different email addresses manually.');
    console.log(`${'='.repeat(60)}\n`);

    console.log('\n✓ All tests completed!');
    console.log('\nExpected behavior:');
    console.log('  - Login: Max 5 requests per 15 minutes');
    console.log('  - Register: Max 3 requests per 1 hour');
    console.log('  - Verify: Max 5 requests per 15 minutes');
    console.log('  - Password Change: Max 5 requests per 1 hour');
    console.log('\nRate limit headers should be present in responses:');
    console.log('  - RateLimit-Limit: Maximum requests allowed');
    console.log('  - RateLimit-Remaining: Requests remaining');
    console.log('  - RateLimit-Reset: Timestamp when limit resets\n');

  } catch (error) {
    console.error('\n✗ Test suite failed:', error.message);
    console.error('\nMake sure:');
    console.error('  1. Backend server is running (npm run dev)');
    console.error('  2. Server is accessible at http://localhost:3000');
    console.error('  3. No firewall blocking the connection\n');
  }
}

// Run the tests
runTests().catch(console.error);
