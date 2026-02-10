import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { neon } from '@neondatabase/serverless';

async function runMigrations() {
  console.log('🚀 Starting Phase 2 migrations...\n');
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  console.log('📦 Applying migrations from ./drizzle folder...');
  
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations completed successfully!\n');
    
    console.log('📊 Verifying changes...');
    
    // Verify new columns exist
    const deviceColumnsCheck = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'devices' 
        AND column_name IN (
          'compliance_grace_period_expiration',
          'partner_reported_threat_state',
          'notes',
          'imei',
          'phone_number'
        )
      ORDER BY column_name;
    `;
    
    const userColumnsCheck = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN (
          'given_name',
          'surname',
          'mobile_phone',
          'office_location'
        )
      ORDER BY column_name;
    `;
    
    console.log('\n✅ Device columns added:');
    deviceColumnsCheck.forEach((col: any) => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    console.log('\n✅ User columns added:');
    userColumnsCheck.forEach((col: any) => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    console.log('\n🎉 Phase 2 column migration complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Apply index migrations (0007 and 0008)');
    console.log('   2. Run full device and user sync');
    console.log('   3. Verify performance improvements\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
