# Phase 2 Migration - Deployment Guide

## Overview
Phase 2 adds 9 new flat columns and 9 critical indexes to improve query performance by 10-200x.

**Changes:**
- 5 new device columns (compliance, mobile device fields, admin notes)
- 4 new user columns (first/last name, mobile, office location)
- 6 B-tree indexes on frequently-queried columns
- 3 GIN indexes on JSONB columns

**Impact:**
- Zero downtime (all operations use CONCURRENTLY)
- Non-breaking (all new columns nullable)
- ~1-2% storage increase (~15-30 MB for 10K devices)
- 10-200x query performance improvement

---

## Prerequisites

1. **Database backup** (critical!)
   ```bash
   # Backup using pg_dump
   pg_dump $DATABASE_URL > backup-before-phase2-$(date +%Y%m%d).sql
   ```

2. **Verify database connection**
   ```bash
   psql $DATABASE_URL -c "SELECT version();"
   ```

3. **Check current schema version**
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
   ```

---

## Deployment Steps

### Step 1: Apply Column Migrations

```bash
# Navigate to project directory
cd "/Users/rohirikman/Library/CloudStorage/GoogleDrive-rohi5054@gmail.com/My Drive/06-Projects/11-device-inventory"

# Option A: Using Drizzle Kit (recommended)
npx drizzle-kit push:pg

# Option B: Manual SQL execution
psql $DATABASE_URL -f drizzle/0006_nifty_bullseye.sql
```

**Expected output:**
```
ALTER TABLE "devices" ADD COLUMN "compliance_grace_period_expiration" timestamp;
ALTER TABLE "devices" ADD COLUMN "partner_reported_threat_state" varchar(50);
ALTER TABLE "devices" ADD COLUMN "notes" text;
ALTER TABLE "devices" ADD COLUMN "imei" varchar(50);
ALTER TABLE "devices" ADD COLUMN "phone_number" varchar(50);
ALTER TABLE "users" ADD COLUMN "given_name" varchar(255);
ALTER TABLE "users" ADD COLUMN "surname" varchar(255);
ALTER TABLE "users" ADD COLUMN "mobile_phone" varchar(50);
ALTER TABLE "users" ADD COLUMN "office_location" varchar(255);
```

**Verification:**
```sql
-- Check device columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'devices' 
  AND column_name IN ('compliance_grace_period_expiration', 'partner_reported_threat_state', 'notes', 'imei', 'phone_number');

-- Check user columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('given_name', 'surname', 'mobile_phone', 'office_location');
```

---

### Step 2: Apply B-tree Indexes

```bash
psql $DATABASE_URL -f drizzle/0007_add_critical_indexes.sql
```

**Duration:** 30-60 seconds for 10K devices (CONCURRENTLY = zero downtime)

**Expected output:**
```
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
```

**Verification:**
```sql
-- Check indexes exist
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'devices' 
  AND indexname LIKE 'idx_devices_%';

-- Verify index usage
EXPLAIN ANALYZE SELECT * FROM devices WHERE is_compliant = false;
-- Should show "Index Scan using idx_devices_is_compliant"
```

---

### Step 3: Apply GIN Indexes

```bash
psql $DATABASE_URL -f drizzle/0008_add_gin_indexes.sql
```

**Duration:** 1-3 minutes for 10K devices with JSONB data (CONCURRENTLY = zero downtime)

**Expected output:**
```
CREATE INDEX
CREATE INDEX
CREATE INDEX
```

**Verification:**
```sql
-- Check GIN indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'devices' 
  AND indexname IN ('idx_devices_security_details', 'idx_devices_detected_apps', 'idx_devices_compliance_details');

-- Test GIN index usage
EXPLAIN ANALYZE 
SELECT * FROM devices 
WHERE security_details @> '{"bitLockerEnabled": true}';
-- Should show "Bitmap Index Scan using idx_devices_security_details"
```

---

### Step 4: Run Full Sync to Populate New Columns

```bash
# Sync users (populates givenName, surname, mobilePhone, officeLocation)
npm run sync:users

# Sync devices (populates compliance_grace_period_expiration, partner_reported_threat_state, imei, phone_number)
npm run sync:devices
```

**Verification:**
```sql
-- Check device data population
SELECT 
  device_name,
  compliance_grace_period_expiration,
  partner_reported_threat_state,
  imei,
  phone_number
FROM devices 
WHERE operating_system IN ('iOS', 'Android')
LIMIT 10;

-- Check user data population
SELECT 
  email,
  given_name,
  surname,
  mobile_phone,
  office_location
FROM users 
LIMIT 10;
```

---

### Step 5: Performance Validation

Run benchmark queries to verify performance improvements:

```sql
-- Benchmark 1: Compliance filter (should be 10-50x faster)
EXPLAIN ANALYZE 
SELECT * FROM devices WHERE is_compliant = false;

-- Benchmark 2: Security query (should be 10-30x faster)
EXPLAIN ANALYZE 
SELECT device_name, security_details->>'bitLockerEnabled' 
FROM devices 
WHERE security_details @> '{"bitLockerEnabled": true}';

-- Benchmark 3: App search (should be 20-100x faster)
EXPLAIN ANALYZE 
SELECT device_name 
FROM devices 
WHERE detected_apps_details @> '[{"displayName": "Microsoft Office"}]';
```

**Expected results:**
- Queries should use "Index Scan" or "Bitmap Index Scan"
- Execution time should be 10-200x faster than before
- No "Seq Scan" in query plans (except for full table scans)

---

## Rollback Plan (If Issues Occur)

### Safe Rollback (Remove indexes only - preserves data)

```sql
-- Drop B-tree indexes (instant, safe)
DROP INDEX CONCURRENTLY IF EXISTS idx_devices_is_compliant;
DROP INDEX CONCURRENTLY IF EXISTS idx_devices_operating_system;
DROP INDEX CONCURRENTLY IF EXISTS idx_devices_jail_broken;
DROP INDEX CONCURRENTLY IF EXISTS idx_devices_user_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_devices_compliance_grace;
DROP INDEX CONCURRENTLY IF EXISTS idx_devices_threat_state;

-- Drop GIN indexes (instant, safe)
DROP INDEX CONCURRENTLY IF EXISTS idx_devices_security_details;
DROP INDEX CONCURRENTLY IF EXISTS idx_devices_detected_apps;
DROP INDEX CONCURRENTLY IF EXISTS idx_devices_compliance_details;
```

Indexes can be recreated anytime by re-running migration files 0007 and 0008.

### Destructive Rollback (Remove columns - ONLY as last resort!)

**WARNING: This deletes data permanently. Restore from backup instead!**

```sql
-- Remove device columns (DESTRUCTIVE!)
ALTER TABLE devices DROP COLUMN compliance_grace_period_expiration;
ALTER TABLE devices DROP COLUMN partner_reported_threat_state;
ALTER TABLE devices DROP COLUMN notes;
ALTER TABLE devices DROP COLUMN imei;
ALTER TABLE devices DROP COLUMN phone_number;

-- Remove user columns (DESTRUCTIVE!)
ALTER TABLE users DROP COLUMN given_name;
ALTER TABLE users DROP COLUMN surname;
ALTER TABLE users DROP COLUMN mobile_phone;
ALTER TABLE users DROP COLUMN office_location;
```

**Better approach:** Restore from backup
```bash
psql $DATABASE_URL < backup-before-phase2-YYYYMMDD.sql
```

---

## Post-Deployment Checklist

- [ ] All 9 columns exist and are nullable
- [ ] All 9 indexes created successfully
- [ ] Full sync completed without errors
- [ ] New columns populated with data
- [ ] Benchmark queries show 10-200x improvement
- [ ] Query plans use indexes (no Seq Scan)
- [ ] Application still functions normally
- [ ] No breaking changes to API responses
- [ ] Monitor database CPU/memory for 24 hours

---

## Monitoring

### Database Performance
```sql
-- Check index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'devices'
ORDER BY idx_scan DESC;

-- Check index sizes
SELECT 
  indexrelname AS index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND indexrelname LIKE 'idx_devices_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%devices%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Expected Outcomes

### Storage Impact
- **Column storage:** ~2.7 MB (for 10K devices, 9 nullable columns)
- **B-tree indexes:** 6-12 MB (6 indexes)
- **GIN indexes:** 9-18 MB (3 indexes)
- **Total increase:** ~18-33 MB (~1-2% of database)

### Performance Improvements
| Query Type | Before | After | Improvement |
|------------|--------|-------|-------------|
| Compliance filter | 200-500ms | 10-30ms | 10-50x |
| OS filter | 150-300ms | 10-20ms | 15x |
| Security JSONB | 1500ms | 50-150ms | 10-30x |
| App search JSONB | 2000ms | 20-100ms | 20-100x |

### Data Quality
- Compliance grace periods now visible
- Partner threat detection exposed
- Mobile device IMEI accessible
- User first/last names properly stored
- Admin notes field available

---

## Support & Troubleshooting

### Issue: Index creation takes too long
**Solution:** This is normal for large datasets. CONCURRENTLY flag ensures zero downtime but takes longer. Wait for completion (up to 5 minutes for 50K+ devices).

### Issue: Query still shows Seq Scan
**Solution:** 
1. Run `ANALYZE devices;` to update statistics
2. Check if query is filtering on indexed column
3. Verify index exists: `\d devices` in psql

### Issue: Sync fails after migration
**Solution:**
1. Check TypeScript compilation: `npm run build`
2. Verify schema types regenerated: `npx drizzle-kit generate`
3. Restart Next.js dev server

### Issue: High memory usage after GIN indexes
**Solution:** This is expected. GIN indexes use more memory but provide massive speedup. Monitor for 24 hours - should stabilize.

---

## Next Steps (Phase 3)

After Phase 2 is stable:
1. **Phase 3A:** Add API endpoints to expose JSONB data
2. **Phase 3B:** Update UI to display new fields
3. **Phase 3C:** Add admin notes editing functionality
4. **Phase 4:** Extract more JSONB data to flat columns (if needed)

---

**Document Version:** v1.0  
**Last Updated:** February 10, 2026  
**Phase:** 2 of 5  
**Status:** Ready for deployment
