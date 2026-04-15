# Codebase Map

Generated: 2026-04-15T09:01:50Z | Files: 141 | Described: 0/141
<!-- gsd:codebase-meta {"generatedAt":"2026-04-15T09:01:50Z","fingerprint":"df9b1398432089f10006ae647d46d4c22bdb489b","fileCount":141,"truncated":false} -->

### (root)/
- `.env.example`
- `.gitignore`
- `.prettierignore`
- `.prettierrc`
- `AGENTS.md`
- `App.tsx`
- `drizzle.config.ts`
- `eslint.config.js`
- `index.html`
- `index.tsx`
- `netlify.toml`
- `OPTIMIZATION_SUMMARY.md`
- `package-lock.json`
- `package.json`
- `QUICK_START.md`
- `README.md`
- `tsconfig.json`
- `types.ts`
- `vite.config.ts`
- `vitest.config.ts`

### .codex/skills/openspec-apply-change/
- `.codex/skills/openspec-apply-change/SKILL.md`

### .codex/skills/openspec-archive-change/
- `.codex/skills/openspec-archive-change/SKILL.md`

### .codex/skills/openspec-bulk-archive-change/
- `.codex/skills/openspec-bulk-archive-change/SKILL.md`

### .codex/skills/openspec-continue-change/
- `.codex/skills/openspec-continue-change/SKILL.md`

### .codex/skills/openspec-explore/
- `.codex/skills/openspec-explore/SKILL.md`

### .codex/skills/openspec-ff-change/
- `.codex/skills/openspec-ff-change/SKILL.md`

### .codex/skills/openspec-new-change/
- `.codex/skills/openspec-new-change/SKILL.md`

### .codex/skills/openspec-onboard/
- `.codex/skills/openspec-onboard/SKILL.md`

### .codex/skills/openspec-sync-specs/
- `.codex/skills/openspec-sync-specs/SKILL.md`

### .codex/skills/openspec-verify-change/
- `.codex/skills/openspec-verify-change/SKILL.md`

### .trae/skills/openspec-apply-change/
- `.trae/skills/openspec-apply-change/SKILL.md`

### .trae/skills/openspec-archive-change/
- `.trae/skills/openspec-archive-change/SKILL.md`

### .trae/skills/openspec-bulk-archive-change/
- `.trae/skills/openspec-bulk-archive-change/SKILL.md`

### .trae/skills/openspec-continue-change/
- `.trae/skills/openspec-continue-change/SKILL.md`

### .trae/skills/openspec-explore/
- `.trae/skills/openspec-explore/SKILL.md`

### .trae/skills/openspec-ff-change/
- `.trae/skills/openspec-ff-change/SKILL.md`

### .trae/skills/openspec-new-change/
- `.trae/skills/openspec-new-change/SKILL.md`

### .trae/skills/openspec-onboard/
- `.trae/skills/openspec-onboard/SKILL.md`

### .trae/skills/openspec-sync-specs/
- `.trae/skills/openspec-sync-specs/SKILL.md`

### .trae/skills/openspec-verify-change/
- `.trae/skills/openspec-verify-change/SKILL.md`

### components/
- `components/ErrorBoundary.tsx`
- `components/LeadDetails.tsx`
- `components/Navbar.tsx`
- `components/PageTransition.tsx`
- `components/ProfileCard.tsx`
- `components/ProfileRow.tsx`
- `components/Skeleton.tsx`
- `components/ThemeToggle.tsx`
- `components/ToastContainer.tsx`
- `components/UserManager.tsx`

### components/charts/
- `components/charts/CareerTimeline.tsx`
- `components/charts/CertificationTimeline.tsx`
- `components/charts/LanguageRadar.tsx`
- `components/charts/PatentCards.tsx`
- `components/charts/RecommendationCards.tsx`
- `components/charts/SkillsChart.tsx`

### components/dashboard/
- `components/dashboard/AboutSection.tsx`
- `components/dashboard/CareerTimeline.tsx`
- `components/dashboard/NetworkTreemap.tsx`
- `components/dashboard/ProfileHeader.tsx`
- `components/dashboard/SkillsSection.tsx`
- `components/dashboard/TalentAnalyticsDashboard.tsx`

### db/
- `db/client.ts`
- `db/schema.ts`

### drizzle/
- `drizzle/0000_dusty_wildside.sql`
- `drizzle/0001_flaky_zombie.sql`
- `drizzle/0002_dashing_champions.sql`
- `drizzle/0003_fixed_leads.sql`
- `drizzle/0004_hesitant_skreet.sql`
- `drizzle/0005_mysterious_joystick.sql`
- `drizzle/relations.ts`
- `drizzle/schema.ts`

### drizzle/meta/
- `drizzle/meta/_journal.json`
- `drizzle/meta/0000_snapshot.json`
- `drizzle/meta/0001_snapshot.json`
- `drizzle/meta/0002_snapshot.json`
- `drizzle/meta/0003_snapshot.json`
- `drizzle/meta/0004_snapshot.json`
- `drizzle/meta/0005_snapshot.json`

### drizzle/migrations/
- `drizzle/migrations/0007_monthly_quotas.sql`

### lib/
- `lib/auth-server.ts`
- `lib/auth.ts`
- `lib/data-transformer.ts`
- `lib/quota-server.ts`
- `lib/ThemeContext.tsx`
- `lib/ToastContext.tsx`
- `lib/validation.ts`

### netlify/functions/
- *(22 files: 22 .ts)*

### openspec/
- `openspec/config.yaml`

### openspec/changes/linkedin-scrape-dedup-tracking/
- `openspec/changes/linkedin-scrape-dedup-tracking/.openspec.yaml`
- `openspec/changes/linkedin-scrape-dedup-tracking/design.md`
- `openspec/changes/linkedin-scrape-dedup-tracking/proposal.md`
- `openspec/changes/linkedin-scrape-dedup-tracking/tasks.md`

### openspec/changes/linkedin-scrape-dedup-tracking/specs/company-scrape-history/
- `openspec/changes/linkedin-scrape-dedup-tracking/specs/company-scrape-history/spec.md`

### openspec/changes/linkedin-scrape-dedup-tracking/specs/scrape-dedup-warning/
- `openspec/changes/linkedin-scrape-dedup-tracking/specs/scrape-dedup-warning/spec.md`

### pages/
- `pages/Admin.tsx`
- `pages/Dashboard.tsx`
- `pages/Home.tsx`
- `pages/Leads.tsx`
- `pages/Login.tsx`
- `pages/Profiles.tsx`

### scripts/
- `scripts/add-tags-tables.cjs`
- `scripts/add-tags-tables.ts`
- `scripts/check-table-structure.js`
- `scripts/check-tables.js`
- `scripts/clean-db.js`
- `scripts/create-admin.js`
- `scripts/create-company-history-table.js`
- `scripts/db-health.js`
- `scripts/drop-all-tables.js`
- `scripts/full-sync.js`
- `scripts/insert-migrations.js`
- `scripts/push-schema.js`

### services/
- `services/admin.ts`
- `services/api.ts`
- `services/apify.ts`
- `services/auth.ts`
- `services/gemini.ts`

### test/
- `test/example.test.ts`
- `test/setup.ts`
