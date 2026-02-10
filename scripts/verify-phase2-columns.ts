import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

console.log('📊 Verifying new columns...\n');

const deviceCols = await sql`
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
  ORDER BY column_name
`;

const userCols = await sql`
  SELECT column_name, data_type, is_nullable 
  FROM information_schema.columns 
  WHERE table_name = 'users' 
    AND column_name IN (
      'given_name',
      'surname',
      'mobile_phone',
      'office_location'
    )
  ORDER BY column_name
`;

console.log('✅ Device columns added:');
deviceCols.forEach(col => {
  console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
});

console.log('\n✅ User columns added:');
userCols.forEach(col => {
  console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
});

await sql.end();
