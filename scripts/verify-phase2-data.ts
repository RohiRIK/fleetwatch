import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

console.log('📊 Verifying Phase 2 data population...\n');

// Check device data
console.log('✅ Device columns data sample:');
const deviceData = await sql`
  SELECT 
    device_name,
    compliance_grace_period_expiration,
    partner_reported_threat_state,
    imei,
    phone_number,
    notes
  FROM devices
  LIMIT 5
`;

deviceData.forEach(device => {
  console.log(`\n   Device: ${device.device_name}`);
  console.log(`   - Compliance grace: ${device.compliance_grace_period_expiration || 'NULL'}`);
  console.log(`   - Threat state: ${device.partner_reported_threat_state || 'NULL'}`);
  console.log(`   - IMEI: ${device.imei || 'NULL'}`);
  console.log(`   - Phone: ${device.phone_number || 'NULL'}`);
  console.log(`   - Notes: ${device.notes || 'NULL (admin-only field)'}`);
});

// Check user data
console.log('\n\n✅ User columns data sample:');
const userData = await sql`
  SELECT 
    email,
    given_name,
    surname,
    mobile_phone,
    office_location
  FROM users
  WHERE given_name IS NOT NULL OR surname IS NOT NULL
  LIMIT 5
`;

userData.forEach(user => {
  console.log(`\n   User: ${user.email}`);
  console.log(`   - First name: ${user.given_name || 'NULL'}`);
  console.log(`   - Last name: ${user.surname || 'NULL'}`);
  console.log(`   - Mobile: ${user.mobile_phone || 'NULL'}`);
  console.log(`   - Office: ${user.office_location || 'NULL'}`);
});

// Summary statistics
console.log('\n\n📈 Population statistics:');

const deviceStats = await sql`
  SELECT 
    COUNT(*) as total_devices,
    COUNT(compliance_grace_period_expiration) as has_grace_period,
    COUNT(partner_reported_threat_state) as has_threat_state,
    COUNT(imei) as has_imei,
    COUNT(phone_number) as has_phone,
    COUNT(notes) as has_notes
  FROM devices
`;

console.log('\n   Devices:');
console.log(`   - Total: ${deviceStats[0].total_devices}`);
console.log(`   - With grace period: ${deviceStats[0].has_grace_period}`);
console.log(`   - With threat state: ${deviceStats[0].has_threat_state}`);
console.log(`   - With IMEI: ${deviceStats[0].has_imei}`);
console.log(`   - With phone: ${deviceStats[0].has_phone}`);
console.log(`   - With notes: ${deviceStats[0].has_notes}`);

const userStats = await sql`
  SELECT 
    COUNT(*) as total_users,
    COUNT(given_name) as has_given_name,
    COUNT(surname) as has_surname,
    COUNT(mobile_phone) as has_mobile,
    COUNT(office_location) as has_office
  FROM users
`;

console.log('\n   Users:');
console.log(`   - Total: ${userStats[0].total_users}`);
console.log(`   - With first name: ${userStats[0].has_given_name}`);
console.log(`   - With last name: ${userStats[0].has_surname}`);
console.log(`   - With mobile: ${userStats[0].has_mobile}`);
console.log(`   - With office: ${userStats[0].has_office}`);

console.log('\n');

await sql.end();
