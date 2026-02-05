
import { permissionVerificationService } from '../src/services/permission-verification.service';
import { redisSessionService } from '../src/services/redis-session.service';

async function main() {
  await redisSessionService.initialize();
  
  const tenantId = "a768d002-710b-4e71-a34a-ce132cbfb3a4";
  const clientId = "acdfab91-bdf0-46b2-916c-b6249fb97291";
  const thumbprint = "91356464878DA3E193D874C55E5CE370FA070592";
  
  console.log('--- STARTING PERMISSION VERIFICATION ---');
  try {
    const report = await permissionVerificationService.verifyAllPermissions(
      tenantId,
      clientId,
      thumbprint
    );
    console.log(JSON.stringify(report, null, 2));
  } catch (error: any) {
    console.error('VERIFICATION FAILED:', error.message);
  }
}

main();
