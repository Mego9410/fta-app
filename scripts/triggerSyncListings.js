// Manual trigger script for sync-listings function
// Usage: node FTA/scripts/triggerSyncListings.js
// 
// Set these environment variables:
//   SUPABASE_URL=https://your-project-ref.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing required environment variables');
  console.error('');
  console.error('Please set:');
  console.error('  SUPABASE_URL=https://your-project-ref.supabase.co');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.error('');
  console.error('Or create a .env file with these values');
  process.exit(1);
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/sync-listings`;

async function main() {
  console.log('Triggering sync-listings function...');
  console.log('URL:', FUNCTION_URL);
  console.log('');

  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      console.error('❌ Sync failed with status:', response.status);
      console.error('Response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('✅ Sync completed successfully!');
    console.log('');
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('');

    if (data.results) {
      console.log('Results:');
      console.log(`  Total listings: ${data.results.total}`);
      console.log(`  Synced: ${data.results.synced}`);
      console.log(`  Errors: ${data.results.errors}`);
    }
  } catch (error) {
    console.error('❌ Error triggering sync:', error.message);
    console.error('');
    console.error('Make sure:');
    console.error('  1. The sync-listings function is deployed to Supabase');
    console.error('  2. The SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct');
    console.error('  3. You have network connectivity');
    process.exit(1);
  }
}

main();