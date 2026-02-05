# Next.js Starter Template Options for Device Inventory Migration

## Executive Summary
Based on the current Device Inventory system requirements (Admin Dashboard, Postgres DB, Auth, Table Views), I've scouted **Vercel's Template Gallery** and identified the top 4 candidates that align with your migration goals.

**Current System Requirements:**
- **UI:** Admin Dashboard with table views for device/user management
- **DB:** Postgres + ORM (Prisma/Drizzle)
- **Auth:** Built-in authentication (ideally compatible with Azure AD/Entra ID)
- **Stack:** Modern Next.js with TypeScript, preferably with shadcn/ui components

---

## Template Options

### Option 1: Next.js SaaS Starter (RECOMMENDED)
* **🔗 Direct URL:** https://vercel.com/templates/next.js/saas-starter
* **GitHub Repo:** https://github.com/nextjs/saas-starter

**Why it fits:**
- **Perfect DB Match:** Built-in Postgres + Drizzle ORM (exactly what you need!)
- **Auth Ready:** Email/password auth with JWT cookies (can be adapted for Azure AD OIDC)
- **Admin Dashboard:** Pre-built dashboard pages with CRUD operations on users/teams
- **RBAC System:** Role-based access control (Owner/Member roles) ready to extend
- **Activity Logging:** Built-in system for tracking user events (perfect for audit trails)
- **Modern UI:** shadcn/ui components + Tailwind CSS v4

**Tech Stack:**
- Next.js 15 (App Router)
- Postgres + Drizzle ORM
- shadcn/ui + Tailwind CSS
- JWT Authentication
- Stripe integration (optional, can be removed)

**Pros:**
- ✅ Officially maintained by Vercel/Next.js team
- ✅ Production-ready with proper RBAC
- ✅ Activity logging system matches your audit needs
- ✅ Dashboard structure ideal for device/user tables
- ✅ Easy to swap auth for Azure AD integration
- ✅ Drizzle ORM migrations included

**Cons:**
- ⚠️ Includes Stripe payment integration (can be removed)
- ⚠️ Auth will need adaptation for Azure AD (JWT → OIDC)
- ⚠️ Currently marked with CVE-2025-55182 (check and update dependencies)

**Migration Effort:** **Medium** (2-3 weeks)
- Adapt auth from JWT to Azure AD OIDC
- Port device/user data models from OpenSearch → Postgres
- Reuse existing API normalization logic

---

### Option 2: Platforms Starter Kit
* **🔗 Direct URL:** https://vercel.com/templates/next.js/platforms-starter-kit
* **GitHub Repo:** https://github.com/vercel/platforms

**Why it fits:**
- **Multi-Tenant Architecture:** Built for managing multiple "tenants" (could map to departments/teams)
- **Redis Integration:** Already includes Redis (matches your current stack)
- **Admin Interface:** Pre-built admin panel for managing tenants
- **Modern Stack:** Next.js 15, Tailwind 4, shadcn/ui

**Tech Stack:**
- Next.js 15 (App Router)
- Redis (Upstash) for data storage
- Tailwind 4 + shadcn/ui
- Subdomain-based routing

**Pros:**
- ✅ Multi-tenant architecture could support department isolation
- ✅ Redis already integrated (familiar from current stack)
- ✅ Admin interface for tenant management
- ✅ Well-documented middleware patterns
- ✅ Actively maintained by Vercel

**Cons:**
- ⚠️ **Uses Redis instead of Postgres** (would require significant data layer changes)
- ⚠️ Subdomain routing may be overkill for device inventory
- ⚠️ No built-in auth system (need to add)
- ⚠️ More focused on content platforms than admin dashboards

**Migration Effort:** **High** (4-6 weeks)
- Need to add Postgres layer or adapt Redis schema
- Build auth system from scratch
- Adapt multi-tenant concepts to device management

---

### Option 3: Next.js Enterprise Boilerplate
* **🔗 Direct URL:** https://vercel.com/templates/next.js/nextjs-enterprise-boilerplate
* **GitHub Repo:** https://github.com/Blazity/next-enterprise

**Why it fits:**
- **Enterprise-Grade:** Built for production environments with comprehensive tooling
- **Testing Suite:** Vitest, Playwright, React Testing Library all configured
- **CI/CD Ready:** GitHub Actions with bundle analysis
- **Type Safety:** Strict TypeScript with ts-reset
- **Storybook:** Component documentation built-in

**Tech Stack:**
- Next.js 15
- Tailwind CSS v4
- Radix UI (similar to shadcn/ui)
- Comprehensive testing & CI/CD
- OpenTelemetry observability

**Pros:**
- ✅ Production-ready infrastructure (health checks, observability)
- ✅ Comprehensive testing setup
- ✅ Strict TypeScript config
- ✅ Well-documented architecture
- ✅ Maintained by Blazity (reputable firm)
- ✅ Includes deployment IaC for AWS (optional)

**Cons:**
- ⚠️ **No database or auth included** (blank canvas approach)
- ⚠️ More of a "boilerplate" than a starter with features
- ⚠️ Steeper initial setup (need to add all business logic)
- ⚠️ Template currently unavailable for direct deploy (GitHub clone only)

**Migration Effort:** **High** (5-7 weeks)
- Build entire data layer from scratch
- Implement auth system
- Build all dashboard UI components
- **However:** Best long-term foundation for enterprise needs

---

### Option 4: VisActor Next.js Dashboard Template
* **🔗 Direct URL:** https://vercel.com/templates/next.js/visactor-dashboard
* **GitHub Repo:** https://github.com/VisActor/next-visactor-template

**Why it fits:**
- **Dashboard-First Design:** Pre-built for data visualization and analytics
- **Chart Library:** VisActor charts integrated (useful for compliance metrics)
- **Dark Mode:** Built-in theme switching
- **Admin Layout:** Pre-configured dashboard structure

**Tech Stack:**
- Next.js 14+
- VisActor charts library
- Tailwind CSS
- Dark mode support

**Pros:**
- ✅ Dashboard UI ready out-of-box
- ✅ Chart components for compliance metrics
- ✅ Modern, professional design
- ✅ Dark mode support

**Cons:**
- ⚠️ **No database integration** (need to add)
- ⚠️ **No auth system** (need to add)
- ⚠️ Less documentation than other options
- ⚠️ Community template (not officially maintained)
- ⚠️ VisActor library adds bundle size

**Migration Effort:** **Medium-High** (3-5 weeks)
- Add entire data layer
- Implement auth
- Adapt dashboard to device/user tables

---

## Decision Matrix

| Criterion | Option 1: SaaS Starter | Option 2: Platforms | Option 3: Enterprise | Option 4: VisActor |
|-----------|------------------------|---------------------|----------------------|-------------------|
| **Database (Postgres)** | ✅ Built-in | ❌ Redis only | ❌ None | ❌ None |
| **Auth System** | ✅ JWT (adaptable) | ❌ None | ❌ None | ❌ None |
| **Admin Dashboard** | ✅ Pre-built | ⚠️ Basic | ❌ None | ✅ Pre-built |
| **Table Components** | ✅ CRUD ready | ⚠️ Basic | ❌ Build from scratch | ⚠️ Chart-focused |
| **Migration Effort** | 🟢 Medium (2-3 weeks) | 🟡 High (4-6 weeks) | 🔴 High (5-7 weeks) | 🟡 Medium-High (3-5 weeks) |
| **Long-Term Maintenance** | 🟢 Official Vercel | 🟢 Official Vercel | 🟢 Professional firm | 🟡 Community |
| **Documentation** | 🟢 Excellent | 🟢 Excellent | 🟢 Excellent | 🟡 Basic |

---

## Final Recommendation

### 🏆 **Choose Option 1: Next.js SaaS Starter**

**Reasoning:**
1. **Lowest Migration Risk:** Postgres + Drizzle matches your desired stack
2. **80% Feature Complete:** Auth, Dashboard, CRUD operations already built
3. **Official Support:** Maintained by Next.js team ensures long-term viability
4. **Activity Logging:** Built-in audit trail system (critical for enterprise)
5. **Quick Time-to-Value:** 2-3 weeks to adapt vs. 5-7 weeks to build from scratch

**Next Steps if you choose Option 1:**
```bash
# Clone the template
git clone https://github.com/nextjs/saas-starter device-inventory-v2
cd device-inventory-v2

# Install dependencies
pnpm install

# Set up local database
pnpm db:setup
pnpm db:migrate

# Run development server
pnpm dev
```

**Key Adaptations Needed:**
1. **Auth Migration:** Replace JWT auth with Azure AD OIDC (using NextAuth.js or Auth0)
2. **Data Model:** Port `devices_v2` and `users_v1` schemas from OpenSearch → Postgres
3. **API Routes:** Adapt existing normalizer logic to Drizzle queries
4. **Remove Stripe:** Delete payment-related code (unless you need billing)
5. **UI Customization:** Replace generic "Teams" with "Devices" terminology

---

## Alternative: "Hybrid Approach"

If you need **maximum enterprise features** but want a **solid foundation**:
- Start with **Option 3 (Enterprise Boilerplate)** for infrastructure
- Add **Option 1's auth + database patterns** as modules
- Build dashboard using **Option 4's UI components**

**Effort:** 6-8 weeks, but creates the most robust long-term solution.

---

## Conclusion

> **Action Required:** Please review the URLs above and select your preferred option (1-4). Once confirmed, we can proceed with:
> ```bash
> git clone <SELECTED_TEMPLATE_URL>
> cd device-inventory-v2
> pnpm install
> ```

**Recommendation Confidence:** **High** - Option 1 (SaaS Starter) provides the fastest path to a production-ready Device Inventory system while maintaining code quality and maintainability.

---

*Document prepared by OpenCode AI Scout*  
*Date: February 5, 2026*  
*Vercel Template Gallery Version: Latest (as of scouting date)*
