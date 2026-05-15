import { SyncService } from './src/app/modules/analysis/sync.service.js';

async function run() {
  console.log('Starting sync...');
  try {
    const result = await SyncService.syncUpcomingRaces();
    console.log('Sync Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Sync failed:', e.message);
    if (e.response && e.response.data) {
       console.log('Sample Data:', JSON.stringify(e.response.data).substring(0, 500));
    }

  }
}

run();
