# FleetWatch Production Launch - Task Tracker

**Generated:** February 5, 2026  
**Status:** 70-75% Complete | Go-Live: Week 3

---

## 🎯 CRITICAL PATH TO PRODUCTION (3 Weeks)

### Week 1: Security Foundation (Days 1-5)

#### ✅ TASK 1.1: RBAC Implementation [CRITICAL] 
**Priority:** 🔴 CRITICAL  
**Duration:** 3-4 days  
**Assignee:** Backend Developer  
**Status:** 📋 TODO

**Objective:** Implement Role-Based Access Control to prevent unauthorized access

**Files to Create:**
- [ ] `drizzle/0004_add_user_roles.sql` - Add role column to users table
- [ ] `lib/auth/rbac.ts` - RBAC helper functions (requireRole, getUserRole, hasPermission)
- [ ] `middleware.ts` - Update to protect admin routes
- [ ] `app/api/devices/[id]/route.ts` - Protect DELETE with requireRole(['ADMIN'])
- [ ] `app/api/users/route.ts` - Protect all mutations with ADMIN role
- [ ] `app/api/cron/sync-devices/route.ts` - Protect with SUPERADMIN role
- [ ] `components/layout/sidebar.tsx` - Hide admin menu items for VIEWER role
- [ ] `__tests__/unit/lib/auth/rbac.test.ts` - Test all permission scenarios

**Acceptance Criteria:**
- [ ] Users table has role column (VIEWER/ADMIN/SUPERADMIN)
- [ ] All admin API routes protected
- [ ] Middleware redirects non-admins from /admin pages
- [ ] UI hides admin features for VIEWER role
- [ ] Tests cover all 3 roles with 10+ scenarios
- [ ] At least one SUPERADMIN account exists

**Dependencies:** None

**Technical Details:**
```typescript
// Role hierarchy
enum UserRole {
  VIEWER = 'VIEWER',      // Read-only access
  ADMIN = 'ADMIN',        // Full access except system config
  SUPERADMIN = 'SUPERADMIN' // Full access including system config
}
```

---

#### ✅ TASK 1.2: Testing Infrastructure [CRITICAL]
**Priority:** 🔴 CRITICAL  
**Duration:** 2-3 days  
**Assignee:** Full Stack Developer  
**Status:** 📋 TODO

**Objective:** Set up automated testing to catch bugs before production

**Files to Create:**
- [ ] `vitest.config.ts` - Vitest configuration
- [ ] `playwright.config.ts` - Playwright E2E configuration
- [ ] `__tests__/setup.ts` - Test setup and mocks
- [ ] `__tests__/unit/lib/auth/rbac.test.ts` - RBAC unit tests
- [ ] `__tests__/unit/lib/services/deviceSync.test.ts` - Device sync tests
- [ ] `__tests__/unit/lib/graph/client.test.ts` - Graph API client tests
- [ ] `__tests__/integration/api/devices.test.ts` - Device API integration tests
- [ ] `__tests__/integration/api/users.test.ts` - User API integration tests
- [ ] `__tests__/e2e/login.spec.ts` - E2E login flow
- [ ] `__tests__/e2e/dashboard.spec.ts` - E2E dashboard interactions
- [ ] `__tests__/e2e/device-management.spec.ts` - E2E device operations

**Acceptance Criteria:**
- [ ] Vitest configured and running
- [ ] Playwright configured for E2E tests
- [ ] At least 20 unit tests written
- [ ] At least 5 integration tests written
- [ ] At least 3 E2E tests written
- [ ] Test coverage > 60% (lib/ and app/api/)
- [ ] All tests pass in CI/CD

**Dependencies:** None (can run in parallel with RBAC)

---

#### ✅ TASK 1.3: Monitoring & Logging [CRITICAL]
**Priority:** 🔴 CRITICAL  
**Duration:** 2 days  
**Assignee:** DevOps + Backend Developer  
**Status:** 📋 TODO

**Objective:** Add observability to detect and diagnose production issues

**Files to Create:**
- [ ] `lib/logger/logger.ts` - Winston logger configuration
- [ ] `lib/monitoring/sentry.ts` - Sentry error tracking setup
- [ ] `app/api/health/route.ts` - Health check endpoint
- [ ] `app/api/metrics/route.ts` - Metrics endpoint (sync status, errors)
- [ ] `app/(dashboard)/admin/monitoring/page.tsx` - Monitoring dashboard
- [ ] `components/monitoring/sync-status.tsx` - Sync status widget
- [ ] `components/monitoring/error-log.tsx` - Recent errors widget
- [ ] `.env.example` - Add SENTRY_DSN, LOG_LEVEL

**Acceptance Criteria:**
- [ ] Sentry capturing errors in production
- [ ] Winston logging to files and console
- [ ] Health check endpoint returns 200 with system status
- [ ] Metrics endpoint shows sync stats and error counts
- [ ] Monitoring dashboard shows real-time status
- [ ] Error alerts sent to Slack/email for critical errors

**Dependencies:** None

**Technical Details:**
- Use Winston for structured logging (info, warn, error levels)
- Use Sentry for error tracking and alerting
- Health check should verify: DB connection, Redis connection, Graph API connectivity
- Metrics should track: Sync success rate, API response times, error rate

---

### Week 2: Robustness (Days 6-10)

#### ✅ TASK 2.1: Settings Page [HIGH]
**Priority:** 🟠 HIGH  
**Duration:** 2-3 days  
**Assignee:** Full Stack Developer  
**Status:** 📋 TODO

**Objective:** Build admin settings UI for system configuration

**Files to Create:**
- [ ] `app/(dashboard)/admin/settings/page.tsx` - Settings page layout
- [ ] `components/settings/sync-schedule-form.tsx` - Sync schedule configuration
- [ ] `components/settings/alert-thresholds-form.tsx` - Alert threshold configuration
- [ ] `components/settings/user-roles-table.tsx` - User role management
- [ ] `lib/actions/settings-actions.ts` - Server actions for settings
- [ ] `lib/db/schema.ts` - Add system_settings table
- [ ] `drizzle/0005_add_system_settings.sql` - Settings table migration

**Acceptance Criteria:**
- [ ] Settings page accessible at /admin/settings (ADMIN+ only)
- [ ] Can configure sync schedule (hourly, daily, custom cron)
- [ ] Can set alert thresholds (compliance %, storage %, battery %)
- [ ] Can manage user roles (promote VIEWER → ADMIN)
- [ ] All changes saved to system_settings table
- [ ] Activity log records all setting changes

**Dependencies:** RBAC (Task 1.1)

---

#### ✅ TASK 2.2: Delta Sync Improvements [HIGH]
**Priority:** 🟠 HIGH  
**Duration:** 2 days  
**Assignee:** Backend Developer  
**Status:** 📋 TODO

**Objective:** Fix delta sync to avoid expensive full syncs

**Files to Modify:**
- [ ] `lib/graph/client.ts` - Improve delta link storage
- [ ] `lib/services/deviceSync.ts` - Better error handling
- [ ] `lib/redis/client.ts` - Add deltaLink caching
- [ ] `app/api/cron/sync-devices/route.ts` - Add deltaLink recovery

**Acceptance Criteria:**
- [ ] Delta link stored in Redis after each sync
- [ ] Delta sync recovers from errors gracefully
- [ ] Falls back to full sync only when necessary
- [ ] Sync logs show "incremental" vs "full" mode
- [ ] Hourly sync completes in < 5 minutes (currently 15-20 min)

**Dependencies:** Monitoring (Task 1.3) - to track improvement

---

#### ✅ TASK 2.3: Error Boundaries [MEDIUM]
**Priority:** 🟡 MEDIUM  
**Duration:** 1 day  
**Assignee:** Frontend Developer  
**Status:** 📋 TODO

**Objective:** Add React Error Boundaries for graceful error handling

**Files to Create:**
- [ ] `components/error-boundary.tsx` - Reusable Error Boundary component
- [ ] `app/error.tsx` - Root error page
- [ ] `app/(dashboard)/error.tsx` - Dashboard error page
- [ ] `app/(dashboard)/devices/error.tsx` - Device page error

**Acceptance Criteria:**
- [ ] Error boundaries wrap all major page sections
- [ ] Errors logged to Sentry with component stack trace
- [ ] User sees friendly error message (not crash)
- [ ] "Report this error" button to submit feedback
- [ ] Error boundaries tested with intentional errors

**Dependencies:** Monitoring (Task 1.3) - for Sentry integration

---

### Week 3: Launch (Days 11-15)

#### ✅ TASK 3.1: Pre-Launch Security Audit [CRITICAL]
**Priority:** 🔴 CRITICAL  
**Duration:** 1 day  
**Assignee:** Security Lead + Tech Lead  
**Status:** 📋 TODO

**Objective:** Identify and fix security vulnerabilities before launch

**Checklist:**
- [ ] Run `npm audit --production` (fix all critical/high)
- [ ] Verify all admin routes protected with RBAC
- [ ] Test RBAC with 3 roles (VIEWER, ADMIN, SUPERADMIN)
- [ ] Check for exposed secrets in .env.local or code
- [ ] Verify CORS configuration in vercel.json
- [ ] Test rate limiting on public API endpoints
- [ ] Review Sentry error logs for security issues
- [ ] Penetration test: Try to access admin APIs as VIEWER
- [ ] Test session expiration and logout
- [ ] Verify HTTPS redirects in production

**Acceptance Criteria:**
- [ ] Zero critical/high npm audit vulnerabilities
- [ ] All RBAC tests pass (10+ scenarios)
- [ ] No secrets committed to Git
- [ ] Rate limiting prevents abuse
- [ ] Penetration tests pass
- [ ] Security audit report approved by Security Lead

**Dependencies:** RBAC (Task 1.1), Testing (Task 1.2)

---

#### ✅ TASK 3.2: Performance Optimization [HIGH]
**Priority:** 🟠 HIGH  
**Duration:** 1 day  
**Assignee:** Frontend Developer  
**Status:** 📋 TODO

**Objective:** Ensure fast page loads and smooth user experience

**Optimization Areas:**
- [ ] Run Lighthouse audit on all pages (target > 90 score)
- [ ] Optimize images (logo, icons) - use next/image
- [ ] Add Redis caching to dashboard API route
- [ ] Add loading states to all async operations
- [ ] Implement virtual scrolling in device table (for 1000+ devices)
- [ ] Code split large components (recharts)
- [ ] Enable Next.js 15 PPR (Partial Prerendering)
- [ ] Minify CSS and JS in production build

**Acceptance Criteria:**
- [ ] Lighthouse score > 90 (Performance, Accessibility, Best Practices)
- [ ] Dashboard loads in < 2s (p95)
- [ ] Device list renders 1000+ devices smoothly
- [ ] All images optimized (WebP format)
- [ ] Redis caching reduces API response time by 50%
- [ ] No layout shift (CLS < 0.1)

**Dependencies:** None

---

#### ✅ TASK 3.3: Staging Deployment & Testing [CRITICAL]
**Priority:** 🔴 CRITICAL  
**Duration:** 1 day  
**Assignee:** DevOps + Tech Lead  
**Status:** 📋 TODO

**Objective:** Deploy to staging and validate before production

**Steps:**
- [ ] Create staging environment in Vercel
- [ ] Configure staging environment variables
- [ ] Deploy to staging (git push origin staging)
- [ ] Run smoke tests on staging
- [ ] Test all critical user flows:
  - [ ] Login with Azure AD
  - [ ] View dashboard
  - [ ] Filter devices
  - [ ] View device details
  - [ ] Trigger manual sync (ADMIN)
  - [ ] Change user role (SUPERADMIN)
  - [ ] View compliance report
  - [ ] Export CSV
- [ ] Run E2E tests on staging
- [ ] Load test with 1000+ devices
- [ ] Verify Sentry capturing errors

**Acceptance Criteria:**
- [ ] Staging environment deployed successfully
- [ ] All smoke tests pass
- [ ] E2E tests pass on staging
- [ ] Load test handles 1000+ devices
- [ ] Sentry capturing errors in staging
- [ ] Team approves staging for production

**Dependencies:** All Week 1-2 tasks must be complete

---

#### 🚀 TASK 3.4: PRODUCTION LAUNCH [CRITICAL]
**Priority:** 🔴 CRITICAL  
**Duration:** 1 day  
**Assignee:** Full Team  
**Status:** 📋 TODO

**Objective:** Deploy to production and monitor for 24 hours

**Launch Day Checklist:**
- [ ] Go/No-Go meeting (1 hour) - All tasks reviewed
- [ ] Backup production database
- [ ] Deploy to production (git push origin main)
- [ ] Verify deployment successful (health check)
- [ ] Run production smoke tests (5 critical flows)
- [ ] Monitor Sentry for 1 hour (zero critical errors)
- [ ] Monitor sync job completion (first sync should succeed)
- [ ] Send launch announcement email to all users
- [ ] Monitor for 24 hours (on-call rotation)

**Rollback Plan:**
- If critical issues arise: `vercel rollback` (< 5 minutes)
- If data issues: Restore database backup (< 30 minutes)
- If sync fails: Run manual full sync (< 1 hour)

**Success Metrics (24 hours):**
- [ ] Zero critical errors in Sentry
- [ ] Sync success rate > 95%
- [ ] Page load < 2s (p95)
- [ ] User adoption > 50% (50 active users in first day)
- [ ] Zero P0 bugs reported

**Dependencies:** Staging deployment approved (Task 3.3)

---

## 📊 POST-LAUNCH: DATA COVERAGE COMPLETION (Weeks 4-12)

### Phase 6.1: Dashboard Enhancements (Week 4)

#### ✅ TASK 6.1.1: Battery Health Alerts Widget
**Priority:** 🟡 MEDIUM  
**Duration:** 4 hours  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `components/dashboard/battery-health-widget.tsx`
- [ ] `app/api/dashboard/battery-alerts/route.ts`

**Objective:** Alert admins to devices with low battery health

**Acceptance Criteria:**
- [ ] Shows devices with < 80% battery health
- [ ] Displays battery health percentage
- [ ] Click to view device details
- [ ] Updates daily

---

#### ✅ TASK 6.1.2: Malware Detection Alerts Widget [CRITICAL]
**Priority:** 🔴 CRITICAL  
**Duration:** 6 hours  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `components/dashboard/malware-alerts-widget.tsx`
- [ ] `app/api/dashboard/malware-alerts/route.ts`

**Objective:** Critical security alert for detected malware

**Acceptance Criteria:**
- [ ] Shows devices with active malware threats
- [ ] Highlights threat severity (high/medium/low)
- [ ] Links to device details → Malware tab
- [ ] Real-time updates (checks every 5 minutes)

---

#### ✅ TASK 6.1.3: Jailbroken/Rooted Device Alerts
**Priority:** 🟠 HIGH  
**Duration:** 4 hours  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `components/dashboard/jailbreak-alerts-widget.tsx`

**Objective:** Security alert for compromised devices

**Acceptance Criteria:**
- [ ] Shows devices with jailBroken = true
- [ ] Displays OS type (iOS/Android)
- [ ] Link to device details
- [ ] Updates daily

---

#### ✅ TASK 6.1.4: Recent Device Actions Widget
**Priority:** 🟡 MEDIUM  
**Duration:** 4 hours  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `components/dashboard/recent-actions-widget.tsx`
- [ ] `app/api/dashboard/recent-actions/route.ts`

**Objective:** Show recent admin actions (wipe, lock, retire)

**Acceptance Criteria:**
- [ ] Shows last 10 device actions from actionsHistory JSONB
- [ ] Displays action type, device name, timestamp, admin name
- [ ] Color-coded by action type (red=wipe, yellow=lock)
- [ ] Real-time updates (WebSocket or polling)

---

### Phase 6.2: Device Details Page - 17 Tabs (Weeks 5-7)

This is the **highest value** addition - 17 tabs to surface all JSONB data.

#### ✅ TASK 6.2.1: Device Details Page Architecture (Day 1)
**Priority:** 🟠 HIGH  
**Duration:** 1 day  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `app/(dashboard)/devices/[id]/page.tsx` - Main layout with tabs
- [ ] `components/devices/device-tabs.tsx` - Tab navigation component
- [ ] `lib/actions/device-details-actions.ts` - Server actions for all tabs

**Objective:** Create tabbed interface for comprehensive device data

---

#### ✅ TASK 6.2.2: Hardware Details Tab (Day 2)
**Priority:** 🟠 HIGH  
**Duration:** 1 day  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `components/devices/tabs/hardware-tab.tsx`

**Displays from hardwareDetails JSONB:**
- IMEI, MEID, WiFi MAC, Ethernet MAC
- Storage (total, free, utilization %)
- Memory (total RAM)
- Battery health %, Battery level %
- Device Guard status, Credential Guard status
- TPM version, Processor architecture

---

#### ✅ TASK 6.2.3: Security & Compliance Tab (Day 3)
**Priority:** 🔴 CRITICAL  
**Duration:** 1 day  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `components/devices/tabs/security-tab.tsx`

**Displays from securityDetails + complianceDetails JSONB:**
- Encryption method (BitLocker, FileVault)
- Encryption algorithm (AES-128, AES-256)
- BitLocker status (On, Off, Suspended)
- TPM status (Present, Enabled, Activated)
- Secure Boot status
- Windows Defender status (version, last scan date)
- Firewall status
- Failed compliance policies (drill-down list)
- Grace period end date

---

#### ✅ TASK 6.2.4: Installed Applications Tab (Day 4)
**Priority:** 🟠 HIGH  
**Duration:** 1 day  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `components/devices/tabs/applications-tab.tsx`

**Displays from detectedAppsDetails JSONB:**
- Application name, version, publisher
- Install date, size
- Search and filter by category
- Sort by name, size, install date

---

#### ✅ TASK 6.2.5: Device Actions History Tab (Day 5)
**Priority:** 🟡 MEDIUM  
**Duration:** 1 day  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `components/devices/tabs/actions-history-tab.tsx`

**Displays from actionsHistory JSONB:**
- Timeline of wipe, lock, retire, sync commands
- Action status (success, pending, failed)
- Initiated by (admin name)
- Timestamps (start, completed)

---

#### ✅ TASK 6.2.6: Malware & Threats Tab (Day 6)
**Priority:** 🔴 CRITICAL  
**Duration:** 1 day  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `components/devices/tabs/malware-tab.tsx`

**Displays from malwareDetails JSONB:**
- Threat name, severity (high/medium/low)
- Detection date, status (active/quarantined/removed)
- Affected file path
- Remediation action taken

---

#### ✅ TASK 6.2.7: Network Configuration Tab (Day 7)
**Priority:** 🟡 MEDIUM  
**Duration:** 0.5 day  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `components/devices/tabs/network-tab.tsx`

**Displays from networkDetails JSONB:**
- IPv4, IPv6, subnet mask, gateway
- DNS servers (primary, secondary)
- WiFi SSID, WiFi MAC
- Ethernet MAC
- Cellular carrier, network type (4G/5G)

---

#### ✅ TASK 6.2.8: Configuration Profiles Tab (Day 8)
**Priority:** 🟡 MEDIUM  
**Duration:** 0.5 day  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `components/devices/tabs/configuration-tab.tsx`

**Displays from configurationDetails JSONB:**
- Profile name, type, status (installed/pending/failed)
- Last modified date
- Assigned groups

---

#### ✅ TASK 6.2.9: Compliance Policies Tab (Day 9)
**Priority:** 🟠 HIGH  
**Duration:** 0.5 day  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `components/devices/tabs/policies-tab.tsx`

**Displays from complianceDetails JSONB:**
- Policy name, status (pass/fail)
- Policy settings (detailed requirements)
- Failure reason (if failed)
- Grace period status

---

#### ✅ TASK 6.2.10-17: Remaining Tabs (Days 10-15)
**Priority:** 🟢 LOW  
**Duration:** 6 days  
**Status:** 📋 TODO

**Remaining tabs:**
- App Crashes Tab (crashesDetails JSONB)
- Warranty Information Tab (warrantyDetails JSONB)
- Endpoint Analytics Tab (analyticsDetails JSONB)
- Conditional Access Tab (conditionalAccessDetails JSONB)
- Organization & Groups Tab (organizationDetails JSONB)
- Lost Mode Tab (lostModeDetails JSONB) - iOS only
- Exchange ActiveSync Tab (exchangeActivesyncDetails JSONB)
- Autopilot Tab (autopilotDetails JSONB)

---

### Phase 6.3: Reports System (Weeks 8-10)

#### ✅ TASK 6.3.1: Reports Infrastructure (Day 1)
**Priority:** 🟠 HIGH  
**Duration:** 1 day  
**Status:** 📋 TODO

**Files to Create:**
- [ ] `app/(dashboard)/admin/reports/page.tsx` - Reports list
- [ ] `lib/reports/report-generator.ts` - CSV/PDF export logic
- [ ] `components/reports/report-card.tsx` - Report selection UI

---

#### ✅ TASK 6.3.2-9: Build 8 Priority Reports (Days 2-10)
**Priority:** 🟠 HIGH  
**Duration:** 9 days  
**Status:** 📋 TODO

**Reports to build:**
1. Devices Non-Compliant Report (with export CSV/PDF)
2. Unencrypted Devices Report
3. Malware Detection Report
4. Battery Health Report
5. Low Storage Report
6. Compliance SLA Report
7. Failed Policies Report
8. Jailbroken/Rooted Devices Report

**Each report includes:**
- Filterable table
- Export to CSV button
- Export to PDF button
- Email report scheduler

---

### Phase 6.4: Analytics Enhancements (Weeks 11-12)

#### ✅ TASK 6.4.1-7: Add Missing Analytics Charts
**Priority:** 🟡 MEDIUM  
**Duration:** 10 days  
**Status:** 📋 TODO

**Charts to add:**
- Battery health trends (30-day)
- Malware detection trends
- Security posture trends (TPM, Secure Boot, Defender)
- Jailbreak detection trends
- Exchange ActiveSync trends
- App installation trends
- Configuration drift analysis

---

## 📈 PROGRESS TRACKING

**Overall Completion:**
```
Phase 0-2 (Infrastructure + Backend):  ███████████████████░░  100%
Phase 3 (Frontend):                    ████████████████████░  90%
Week 1 (Security Foundation):          ░░░░░░░░░░░░░░░░░░░░  0%
Week 2 (Robustness):                   ░░░░░░░░░░░░░░░░░░░░  0%
Week 3 (Launch):                       ░░░░░░░░░░░░░░░░░░░░  0%
Phase 6 (Data Coverage 40% → 100%):    ░░░░░░░░░░░░░░░░░░░░  0%
```

**Current Status:** 70-75% Complete  
**Go-Live Target:** Week 3 (Feb 19, 2026)  
**100% Data Coverage:** Week 12 (April 2026)

---

## 🚀 QUICK START

**To begin Week 1, Task 1 (RBAC):**

```bash
# 1. Create database migration for user roles
drizzle-kit generate:pg

# 2. Apply migration
drizzle-kit push:pg

# 3. Create RBAC helper file
touch lib/auth/rbac.ts

# 4. Start implementing requireRole() function
# See docs/12_Production_Launch_Plan.md for full code examples
```

---

## 📞 TEAM CONTACTS

- **Tech Lead:** [Name] - [Email]
- **Backend Developer:** [Name] - [Email]
- **Frontend Developer:** [Name] - [Email]
- **DevOps:** [Name] - [Email]
- **Security Lead:** [Name] - [Email]

---

## 📚 RELATED DOCUMENTATION

- **Full Production Plan:** `docs/12_Production_Launch_Plan.md` (65KB, 1400+ lines)
- **Executive Summary:** `docs/12_EXECUTIVE_SUMMARY.md`
- **Development Roadmap:** `docs/11_Development_Roadmap.md`
- **Data Coverage Analysis:** `docs/DATA-COVERAGE-ANALYSIS.md`
- **Database Schema:** `docs/03_Database_Schema_Design.md`
- **RBAC Specification:** `docs/07_Auth_and_RBAC_Spec.md`

---

**Last Updated:** February 5, 2026  
**Next Review:** Daily standup at 9:00 AM
