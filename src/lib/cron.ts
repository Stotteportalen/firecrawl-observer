import cron from 'node-cron';
import { checkActiveWebsites } from './services/monitoring';

let isRunning = false;

export function startCronJobs() {
  // Check active websites every minute
  cron.schedule('* * * * *', async () => {
    if (isRunning) {
      console.log('[cron] Previous check still running, skipping...');
      return;
    }

    isRunning = true;
    try {
      await checkActiveWebsites();
    } catch (error) {
      console.error('[cron] Error checking websites:', error);
    } finally {
      isRunning = false;
    }
  });

  console.log('[cron] Website monitoring cron job started (every minute)');
}
