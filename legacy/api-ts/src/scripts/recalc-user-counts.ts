
import { createOpenSearchClient, INDICES } from '../config/opensearch';
import { UserNormalizer } from '../normalizers/user-normalizer';
import { normalizeDevices } from '../normalizers/device-normalizer';

const client = createOpenSearchClient();
const BATCH_SIZE = 100;

async function recalcUserCounts() {
  console.log('Starting User Device Count Remediation...');

  try {
    // 1. Fetch all devices first (to build the correlation map)
    // For 2-3k devices, we can load them into memory. If millions, this would need optimization.
    console.log('Fetching all devices...');
    const deviceResponse = await client.search({
      index: INDICES.DEVICES,
      size: 10000, // Assuming < 10k devices for this fix
      body: { query: { match_all: {} } }
    });

    const devices = deviceResponse.body.hits.hits.map((h: any) => h._source);
    console.log(`Loaded ${devices.length} devices into memory.`);

    // 2. Scroll through all users
    console.log('Scanning users...');
    const params = {
      index: INDICES.USERS,
      scroll: '1m',
      size: BATCH_SIZE,
      body: { query: { match_all: {} } }
    };

    let response = await client.search(params);
    let processed = 0;
    let updated = 0;

    while (response.body.hits.hits.length > 0) {
      const users = response.body.hits.hits.map((h: any) => h._source);
      const bulkBody: any[] = [];

      for (const user of users) {
        // Find devices for this user
        const userDevices = devices.filter((d: any) => 
          d.userId === user.id || 
          (d.userPrincipalName && user.userPrincipalName && 
           d.userPrincipalName.toLowerCase() === user.userPrincipalName.toLowerCase())
        );

        // If we found devices, but the user has 0, OR if we want to force refresh
        if (userDevices.length > 0) {
           // Calculate summary
           const compliantDevices = userDevices.filter((d: any) => d.complianceState === 'compliant').length;
           const nonCompliantDevices = userDevices.filter((d: any) => d.complianceState === 'noncompliant').length;
           const platforms: Record<string, number> = {};
           userDevices.forEach((d: any) => {
             const os = d.operatingSystem || 'Unknown';
             platforms[os] = (platforms[os] || 0) + 1;
           });

           const managed = userDevices.map((d: any) => ({
             deviceId: d.id,
             deviceName: d.deviceName,
             model: d.model,
             operatingSystem: d.operatingSystem,
             complianceState: d.complianceState,
             lastSync: d.lastSyncDateTime
           }));

           const newSummary = {
             totalDevices: userDevices.length,
             compliantDevices,
             nonCompliantDevices,
             platforms
           };

           // Check if update is needed (simple check)
           if (user.devices?.summary?.totalDevices !== newSummary.totalDevices) {
             bulkBody.push({ update: { _index: INDICES.USERS, _id: user.id } });
             bulkBody.push({
               doc: {
                 devices: {
                   managed,
                   summary: newSummary
                 },
                 dataQuality: {
                   ...user.dataQuality,
                   hasDevices: true,
                   lastEnrichedAt: new Date().toISOString()
                 }
               }
             });
             updated++;
           }
        }
      }

      if (bulkBody.length > 0) {
        await client.bulk({ body: bulkBody });
        process.stdout.write('.');
      }

      processed += users.length;
      
      if (!response.body._scroll_id) break;
      
      response = await client.scroll({
        scroll_id: response.body._scroll_id,
        scroll: '1m'
      });
    }

    console.log(`
Remediation complete.`);
    console.log(`Processed: ${processed} users`);
    console.log(`Updated:   ${updated} users with missing device counts`);

  } catch (error) {
    console.error('Error during remediation:', error);
  }
}

recalcUserCounts();
