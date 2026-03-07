import { registerHandler } from './handlers';
import { handleExtractionComplete } from './handlers/extraction';
import { handleDiscoveryComplete, handleDiscoveryListingComplete, handleDiscoveryFailure } from './handlers/discovery';
import { handleClassificationComplete } from './handlers/classification';
import { handleMonitoringComplete } from './handlers/monitoring';
import { handleScrapeComplete } from './handlers/scrape';
import { handleCrawlComplete } from './handlers/crawl';

let registered = false;

export function registerAllHandlers() {
  if (registered) return;
  registered = true;

  registerHandler('extraction', handleExtractionComplete);
  registerHandler('discovery', handleDiscoveryComplete, handleDiscoveryFailure);
  registerHandler('discovery_listing', handleDiscoveryListingComplete);
  registerHandler('classification', handleClassificationComplete);
  registerHandler('monitoring', handleMonitoringComplete);
  registerHandler('scrape', handleScrapeComplete);
  registerHandler('crawl', handleCrawlComplete);
}
