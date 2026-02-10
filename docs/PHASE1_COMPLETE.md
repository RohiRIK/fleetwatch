# Device Inventory v2 - Phase 1 Setup Complete

## What We've Completed

Phase 1 (Docker + Database Setup) is **95% complete**. All configuration files have been created and are ready to use.

### Files Created

```
docker-compose.yml              # 4 services: Postgres, Redis, Angie, pgAdmin
angie/angie.conf                # Main Angie configuration
angie/conf.d/default.conf       # Reverse proxy to Next.js
angie/certs/localhost.crt       # SSL certificate (self-signed)
angie/certs/localhost.key       # SSL private key
scripts/generate-certs.sh       # Certificate generation script
lib/db/schema.ts                # Drizzle schema (6 tables)
lib/db/drizzle.ts               # Database client
lib/redis/client.ts             # Redis client
drizzle.config.ts               # Drizzle Kit configuration
.env.local                      # Environment variables (UPDATE AZURE CREDENTIALS!)
```

### Dependencies Installed

- ✅ Removed `@vercel/postgres`
- ✅ Added `postgres` (postgres-js)
- ✅ Added `ioredis`
- ✅ Added `@types/ioredis`

### Scripts Added to package.json

```bash
bun run db:generate      # Generate Drizzle migrations
bun run db:push          # Push schema to database
bun run db:studio        # Open Drizzle Studio
bun run docker:up        # Start Docker services
bun run docker:down      # Stop Docker services
bun run docker:logs      # View Docker logs
bun run angie:certs      # Generate SSL certificates
bun run angie:reload     # Reload Angie config
```

---

## Next Steps (Manual)

### Step 1: Update Azure AD Credentials

Edit `.env.local` and replace these placeholders:

```env
AZURE_AD_CLIENT_ID=your_azure_ad_client_id_here
AZURE_AD_CLIENT_SECRET=your_azure_ad_client_secret_here
AZURE_AD_TENANT_ID=your_azure_ad_tenant_id_here
```

### Step 2: Start Docker Desktop

**Docker daemon is not running!**

1. Open Docker Desktop application
2. Wait for Docker to start (check menu bar icon)
3. Verify with: `docker ps`

### Step 3: Start Docker Services

```bash
bun run docker:up
```

This will start:
- **Postgres** on port 5432
- **Redis** on port 6379
- **Angie** on ports 80, 443, 8080
- **pgAdmin** on port 5050

Verify all services are healthy:
```bash
docker-compose ps
```

Expected output:
```
NAME                          STATUS        PORTS
device-inventory-angie        Up (healthy)  80, 443, 8080
device-inventory-postgres     Up (healthy)  5432
device-inventory-redis        Up (healthy)  6379
device-inventory-pgadmin      Up            5050
```

### Step 4: Initialize Database

Generate and apply Drizzle migrations:

```bash
bun run db:generate  # Creates migration files in drizzle/
bun run db:push      # Applies migrations to Postgres
```

This creates 6 tables:
1. `users` - Azure AD users
2. `devices` - Intune devices
3. `teams` - Organization teams
4. `team_members` - User-team relationships
5. `activity_logs` - Audit trail
6. `sync_logs` - Sync execution logs

### Step 5: Start Next.js Dev Server

```bash
bun dev
```

Next.js will run on `http://localhost:3000`

### Step 6: Access Applications

**Via Angie (Reverse Proxy):**
- https://localhost (redirects from http://localhost)
- Metrics: http://localhost:8080/metrics

**Direct Access:**
- Next.js: http://localhost:3000
- pgAdmin: http://localhost:5050
  - Email: `admin@device-inventory.local`
  - Password: `admin`

**Browser Security Warning:**
- You'll see "Your connection is not private" - this is expected
- Click "Advanced" → "Proceed to localhost (unsafe)"
- This is normal for self-signed certificates in development

**Optional: Trust Certificate (macOS)**
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ./angie/certs/localhost.crt
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│          Angie (Ports 80/443/8080)                      │
│       Reverse Proxy + Metrics + HTTPS                   │
└──────────────┬──────────────────────────────────────────┘
               │
       ┌───────▼────────┐
       │   Next.js 16   │  ← Running on HOST (not in Docker)
       │  (UI + API)    │     Port 3000
       │                │
       │  - App Router  │
       │  - Server Acts │
       │  - API Routes  │
       │  - Cron Jobs   │
       └───────┬────────┘
               │
    ┌──────────┼──────────┬─────────────┐
    │          │          │             │
┌───▼───┐  ┌──▼──┐   ┌───▼────┐   ┌────▼────┐
│Postgres│  │Redis│   │ Angie  │   │ pgAdmin │
│5432    │  │6379 │   │80/443  │   │ 5050    │
└────────┘  └─────┘   └────────┘   └─────────┘
```

**Key Points:**
- Next.js runs on **host machine** (not in Docker) for better hot-reload performance
- Angie proxies requests from `host.docker.internal:3000`
- Database and cache run in Docker for consistency
- All services communicate via Docker network

---

## Database Schema

### Tables (6 total)

**1. users** - Azure AD employees
```sql
id, email, name, display_name, job_title, department, azure_id
```

**2. devices** - Intune managed devices
```sql
id, azure_id, device_name, serial_number, user_id,
os_version, manufacturer, model,
is_encrypted, is_compliant, compliance_details (JSONB),
storage_total, storage_free, memory_total, battery_health,
last_sync_at, created_at, updated_at, deleted_at
```

**3. teams** - Organization units
```sql
id, name, slug, created_at, updated_at
```

**4. team_members** - User-team relationships
```sql
id, user_id, team_id, role (OWNER/MEMBER), created_at, updated_at
```

**5. activity_logs** - Audit trail
```sql
id, user_id, action, entity_type, entity_id, metadata (JSONB),
ip_address, created_at
```

**6. sync_logs** - Microsoft Graph API sync history
```sql
id, sync_type, records_synced, records_failed, error_message,
duration_ms, started_at, completed_at
```

---

## Credentials

### Postgres
- **Host:** localhost:5432
- **Database:** device_inventory
- **User:** postgres
- **Password:** postgres

### Redis
- **Host:** localhost:6379
- **Password:** changeme

### pgAdmin
- **URL:** http://localhost:5050
- **Email:** admin@device-inventory.local
- **Password:** admin

**To connect pgAdmin to Postgres:**
1. Open http://localhost:5050
2. Right-click "Servers" → "Register" → "Server"
3. General tab: Name = "Device Inventory"
4. Connection tab:
   - Host: `postgres` (use Docker service name, not localhost!)
   - Port: 5432
   - Database: device_inventory
   - Username: postgres
   - Password: postgres
5. Click "Save"

---

## Troubleshooting

### Docker not starting
```bash
# Check Docker status
docker ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart
```

### Database connection issues
```bash
# Check Postgres is ready
docker-compose exec postgres pg_isready -U postgres

# Connect to Postgres
docker-compose exec postgres psql -U postgres -d device_inventory

# View tables
\dt
```

### Redis connection issues
```bash
# Test Redis connection
docker-compose exec redis redis-cli -a changeme ping
# Expected output: PONG
```

### Angie not proxying
```bash
# Check Angie logs
docker-compose logs angie

# Test Angie health
curl http://localhost:8080/status

# Reload Angie config
bun run angie:reload
```

### Next.js not building
```bash
# Check TypeScript errors
bun run build

# Clear Next.js cache
rm -rf .next
```

---

## What's Next: Phase 2

Phase 1 is complete! Next phase will implement:

1. **NextAuth.js Setup** - Azure AD authentication
2. **Microsoft Graph Client** - API wrapper for Intune/Azure AD
3. **Server Actions** - 15 actions for CRUD operations
4. **Cron Job** - Sync devices and users every 6 hours
5. **UI Components** - Dashboard, device list, device details

See `/docs/11_Development_Roadmap.md` for full 10-week plan.

---

## Quick Reference

**Start everything:**
```bash
# 1. Start Docker services
bun run docker:up

# 2. Initialize database (first time only)
bun run db:push

# 3. Start Next.js
bun dev
```

**Stop everything:**
```bash
# Stop Next.js (Ctrl+C in terminal)

# Stop Docker
bun run docker:down
```

**View logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f angie
```

**Database management:**
```bash
# Open Drizzle Studio (visual DB editor)
bun run db:studio

# OR use pgAdmin
open http://localhost:5050
```

---

## Environment Summary

- **Next.js:** 16.1.6
- **TypeScript:** 5.x (strict mode)
- **Package Manager:** Bun 1.3.8
- **Database:** Postgres 16 (Alpine)
- **Cache:** Redis 7 (Alpine)
- **Reverse Proxy:** Angie (latest)
- **ORM:** Drizzle ORM 0.45.1
- **UI:** shadcn/ui (13 components)
- **Auth:** NextAuth.js 5.0.0-beta.30

---

**Status:** Phase 1 Complete (awaiting Docker start + DB initialization)  
**Last Updated:** February 5, 2026  
**Next Action:** Start Docker Desktop → `bun run docker:up` → `bun run db:push`
