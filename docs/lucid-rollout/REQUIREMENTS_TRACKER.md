# Lucid Rollout — Master Requirement Tracker

**Owner:** human (orchestrator) · **Update freq:** same change that moves a requirement's state · **Source of truth for requirement IDs.**

Every requirement has one stable ID and exactly one **primary milestone**. Every
PR / commit / test / deployment / acceptance references its IDs. This file and
[`STATUS.md`](./STATUS.md) update in the same change that materially moves state.

## Controlled statuses
`Backlog` → `Ready` (deps + acceptance criteria explicit) → `In progress` →
`Blocked` → `In review` → `Ready for QA` (focused tests pass) → `Ready for
production` (security/migration/rollback reviewed) → `Deployed` (production
evidence) → `Accepted` (acceptance test + stakeholder sign-off). `Deferred`
(reason + revisit trigger). **`Deployed` ≠ `Accepted`.**

## Priority
`P0` pilot/production blocker · `P1` dependable-rollout · `P2` post-pilot.

## Field conventions
`Deploy` column = production deployment state. **Owner and Acceptance owner/date
default to `TBD`** until assigned (kept out of the table for width; assign in the
milestone working notes). `Code/Evidence` cites `file:line` from the audit.
Priorities/milestones trace to [`ROADMAP.md`](./ROADMAP.md); gaps to
[`GAP_ASSESSMENT.md`](./GAP_ASSESSMENT.md); decisions `LR-*` to
[`DECISIONS.md`](./DECISIONS.md). Source = the post-demo brief unless noted.

---

## AUTH — credential auth & session
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| AUTH-001 | Username/email + password login (all 3 actors) | P0 | M1 | In review | — | `auth.ts` password provider + `credentials.ts` + sign-in form (flag `CREDENTIAL_AUTH`) | LR-001/002 | operator+technician DONE + tested; **tenant** credential login next |
| AUTH-002 | Argon2id/bcrypt hashing, never plaintext | P0 | M1 | In review | — | `lib/server/password.ts` (bcrypt cost 12) | AUTH-001 | Argon2id = documented future swap |
| AUTH-003 | Secure HTTP-only cookie sessions | P0 | M1 | Deployed | prod | NextAuth JWT; HMAC cookies `tenant-auth.ts:32-38` | | reused for credentials |
| AUTH-004 | Rate limiting + brute-force lockout | P0 | M1 | In review | — | per-account lockout (5/15min) `credentials.ts` | AUTH-001 | **per-IP deferred** (needs Redis) |
| AUTH-005 | Password reset + admin-assisted reset | P0 | M1 | In progress | — | `setStaffPassword` (admin-assisted) `credentials.ts` | AUTH-001 | self-serve reset route pending |
| AUTH-006 | First-login / set-password provisioning | P0 | M1 | In progress | — | `provisionStaffAccount` `credentials.ts` | AUTH-005, IDN-002 | invite→set-password UI pending |
| AUTH-007 | Logout / session revocation | P1 | M1 | Deployed | prod | tenant signout route; NextAuth signOut | AUTH-001 | |
| AUTH-008 | No account-existence disclosure on errors | P0 | M1 | In review | — | generic null + timing mitigation `password.ts`/`credentials.ts`; tested | AUTH-001 | |

## IDN — individual identity & provisioning
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| IDN-001 | Individual identity attached to each submission | P0 | M1 | Partial→Ready | prod | `createdByTenantUserId` set `tenant-work-orders.ts:76`; display gaps | AUTH-001 | show submitter name+email in ops+tech |
| IDN-002 | Account provisioning + deactivation | P0 | M1 | In review | — | `provisionStaffAccount`; `status='deactivated'` blocks login (tested) `credentials.ts` | AUTH-005 | admin UI pending |
| IDN-003 | No shared generic Lucid identity in prod | P0 | M1 | Ready | — | current Lucid tenants are individual rows | IDN-001 | enforce individual creds |
| IDN-004 | Audit history for account/permission changes | P1 | M1 | Backlog | — | `audit_log` exists, not used for accounts | SEC-002 | log role/status changes |

## SEC — security & authorization
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| SEC-001 | Server-side authorization (not UI-only) | P0 | M1 | Deployed | prod | `withStaffScope`/RLS `db.ts:68-85` | | verify for new surfaces |
| SEC-002 | Role model + RBAC read of `users.role` | P0 | M1 | In review | — | `lib/server/roles.ts` + `loadStaffRole` + session `role`; tests | AUTH-001 | surface-gating (admin pages/tech surface) wired in M3/M4 |
| SEC-003 | `technician` role added + enforced | P0 | M1 | In review | — | `technician` role value + predicates `roles.ts`; `users.role` supports it; tests | SEC-002, LR-005 | enforcement wiring M3/M4 |
| SEC-004 | Tenant/building isolation (RLS) for new model | P0 | M3 | Ready | — | RLS solid `rls-policies.sql` | LOC-008 | extend to LOC tables |
| SEC-005 | CSP + security headers | P1 | M1 | Partial | prod | headers set, no CSP `next.config.ts:32` | | add CSP |
| SEC-006 | Secrets management (no committed creds/keys) | P0 | M0 | In review | — | CI env-file guard; `scripts/_prod-guard.ts`; `.gitignore` quarantine | | no committed env files; 5 prod one-offs git-ignored (local-only guards, NOT committed); 1 read-only generalized to a committed tool |
| SEC-007 | Remove dead Clerk dep + demo stub in prod | P1 | M0 | In progress | — | `@clerk/nextjs` removed (`web/package.json` + lockfile); no live imports | LR-001 | demo `Credentials` stub removal deferred to M1 (removing it now would break dev sign-in) |

## TEN — tenant mobile experience
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| TEN-001 | Mobile request intake (title/desc/category/location/photos) | P0 | M2 | Deployed | prod | `createWorkOrderFromTenant` `tenant-work-orders.ts:37` | | location=session-derived |
| TEN-002 | Requester identity shown on request | P0 | M1 | Partial | prod | stored; display gaps | IDN-001 | |
| TEN-003 | Accurate building/floor/suite/company context | P0 | M3 | Backlog | — | flat model today | LOC-* | |
| TEN-004 | Category selection | P0 | M2 | Deployed | prod | `work-order-category.ts` | ADM-004 | add commercial cats |
| TEN-005 | Photo upload w/ progress, retry, success | P0 | M2 | Partial | prod | tenant multipart `tenant/uploads/sign` | ATT-006/007/008 | |
| TEN-006 | Message thread visible to tenant | P0 | M2 | In review | — | unblocked by MSG-001 fix; tenant `external` read path was already correct | MSG-001 | not deployed |
| TEN-007 | Tenant status visibility + history | P0 | M2 | Deployed | prod | `tenantStatusLabel` `labels.ts:72` | LIF-007 | |
| TEN-008 | Completion summary visible to tenant | P0 | M5 | In review | — | tenant detail shows completed date + technician (tenant-safe; no internal notes) | SUM-001/002 | not deployed |
| TEN-009 | Confirm-fixed / reopen | P0 | M5 | Deployed | prod | `tenant-work-orders.ts:356-458` | LIF-004/005 | |
| TEN-010 | Empty/loading/error/offline/session-expiry states | P1 | M2 | Partial | prod | some states exist | | audit each |

## ASN — automatic assignment & routing
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| ASN-001 | Tenant-submitted WO auto-assigns covering tech | P0 | M2 | In review | — | **FIXED**: inserts `assignments` row + status `assigned` `tenant-work-orders.ts`; test `m2-tenant-defects` | | not deployed |
| ASN-002 | Building→technician ownership config | P0 | M3 | Partial | prod | property-level only `properties.defaultAssigneeUserId` | LOC-006 | extend to buildings |
| ASN-003 | Default/fallback assignee (org-level) | P0 | M3 | In review | — | `org_settings.fallbackAssigneeUserId` + routing `tenant-work-orders.ts`; test `m3-routing` | ADM-003 | not deployed |
| ASN-004 | Manual reassignment | P1 | M3 | Partial | prod | vendor reassign; no staff-user per-WO UI | | |
| ASN-005 | Technician absence / escalation coverage | P1 | M3 | Not-impl | — | none | ASN-003 | |
| ASN-006 | Assignment audit trail (auto + manual) | P1 | M3 | Partial | prod | `assignments` + audit | | ensure tenant path audits |
| ASN-007 | Assignment reasoning visible to STACK | P1 | M3 | Not-impl | — | none | | "assigned via building rule" |
| ASN-008 | Prevent silent unassigned | P0 | M3 | In review | — | property tech → org-fallback chain `tenant-work-orders.ts`; test `m3-routing` | ASN-001/003 | not deployed (no-fallback case still lands `new`) |

## MSG — messaging
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| MSG-001 | Fix ops reply invisible to resident | P0 | M2 | In review | — | **FIXED**: drawer composer defaults `external` ("reply to requester") on tenant WOs `entity-drawer.tsx` | LR-007 | not deployed |
| MSG-002 | Back-and-forth tenant↔technician | P0 | M4 | Partial | prod | tenant↔ops exists; tech surface pending | TEC-005, MSG-001 | |
| MSG-003 | STACK visibility of threads | P0 | M2 | Deployed | prod | drawer no visibility filter `entity-detail.ts:730-748` | | |
| MSG-004 | Sender identity + timestamp + audience label | P1 | M2 | Partial | prod | labels imprecise ("with vendor") `entity-drawer.tsx:1084` | | |
| MSG-005 | Internal-note vs participant-visible separation | P0 | M2 | Deployed | prod | `visibility` + RLS `comments_tenant_self` | | no leak — verified by test |
| MSG-006 | New-message indication + notification | P1 | M6 | Partial | prod | `wo_message` `comments.ts:80` | EML-003 | |
| MSG-007 | Persistence across refresh/device + order/pagination | P1 | M2 | Partial | prod | ordered; no pagination | | |
| MSG-008 | Idempotent/safe repeated submission | P1 | M2 | Backlog | — | none | | |
| MSG-009 | Visibility-boundary tests (tenant/tech/operator) | P0 | M2 | Partial | prod | `tenant-rls.test.ts` | | add tech boundary |
| MSG-010 | `createTenantComment` stamps `tenantUpdatedAt` | P1 | M2 | In review | — | **FIXED** `tenant-work-orders.ts`; test `m2-tenant-defects` | | not deployed |

## ATT — photos & attachments
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| ATT-001 | Tenant photos reach STACK | P0 | M2 | Deployed | prod | staff RLS read `entity-detail.ts:243-254` | | verify |
| ATT-002 | Tenant photos reach assigned technician | P0 | M4 | Partial | prod | vendor RLS exists; tech role read pending | SEC-003 | |
| ATT-003 | Technician photo capture/upload | P0 | M4 | Backlog | — | staff path exists; tech surface pending | | |
| ATT-004 | STACK views all photos (thumb + full) | P0 | M2 | Deployed | prod | signed URLs `storage.ts:79-83` | | |
| ATT-005 | Safe signed access + role-level access | P0 | M2 | Deployed | prod | RLS + 300s GET | | |
| ATT-006 | HEIC + mobile format support | P0 | M2 | Not-impl | — | no HEIC handling | | iPhone default |
| ATT-007 | File-type + size validation (consistent) | P0 | M2 | Partial | prod | tenant 50MB; staff none; no MIME allowlist | | |
| ATT-008 | Upload error handling + retry | P1 | M2 | Partial | prod | tenant path has retry | | |
| ATT-009 | Attachment metadata + audit | P1 | M2 | Partial | prod | metadata yes; audit thin | | |
| ATT-010 | Completion photos linked to completion record | P0 | M5 | Backlog | — | `after_photo` kind exists, unused by tenant path | SUM-001 | |

## TEC — technician workflow
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| TEC-001 | Individual technician accounts (users+technician) | P0 | M3 | Backlog | — | Oscar/Fernando seed staff | SEC-003, LR-005 | real accounts |
| TEC-002 | Mobile assigned-work queue (only their work) | P0 | M4 | In review | — | `technician.ts` `loadTechnicianQueue` + `/tech`; test `m4-technician` | ASN-001 | not deployed |
| TEC-003 | WO detail (requester, bldg/floor/suite/company, category, scope, photos, access) | P0 | M4 | In review | — | `loadTechnicianWorkOrder` + `/tech/[ref]` (requester, floor/suite, photos, desc); test | LOC-*, TEN-003 | company display follow-up |
| TEC-004 | Acknowledge/start action | P0 | M4 | In review | — | `techAcknowledge`/`techSetStatus`; `/tech/[ref]` buttons | ASN-001 | not deployed |
| TEC-005 | Technician messaging | P0 | M4 | In review | — | `techReplyToRequester` (external, tested) + note | MSG-001 | not deployed |
| TEC-006 | Technician notes | P0 | M4 | In review | — | `techAddNote` (internal) | | not deployed |
| TEC-007 | Technician photo upload | P0 | M4 | In progress | — | detail **shows** photos; tech upload UI pending (reuses staff signed-upload) | ATT-003 | UI follow-up |
| TEC-008 | Status updates | P0 | M4 | In review | — | `techSetStatus` exposed on `/tech/[ref]`, assignment-guarded | LIF-002 | not deployed |
| TEC-009 | Authoritative completion (no redundant step) | P0 | M4 | In review | — | `techComplete` → reuses authoritative `updateWorkOrderStatus`; test `m4-technician` | LR-006, LIF-003 | not deployed |
| TEC-010 | Add/manage additional technicians | P1 | M3 | Backlog | — | none | ADM-001 | |
| TEC-011 | Reassignment/coverage for absence | P1 | M3 | Not-impl | — | none | ASN-005 | |
| TEC-012 | Overdue/priority/schedule info | P1 | M4 | Partial | prod | ops lanes exist | | tech view |
| TEC-013 | Technician audit trail | P1 | M4 | Partial | prod | `audit_log` | | |

## LIF — work-order lifecycle
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| LIF-001 | Canonical state machine documented + reconciled | P0 | M0 | Ready | prod | `work-order.ts:9-35` | | see WORK_ORDER_LIFECYCLE.md |
| LIF-002 | Server-side invalid-transition prevention (incl. bypasses) | P0 | M5 | Partial | prod | enforced `work-orders.ts:248`; raw bypasses exist | | route bypasses through guard |
| LIF-003 | Prevent duplicate completion server-side | P0 | M5 | Partial | prod | single writer; add explicit guard | LR-006 | |
| LIF-004 | Confirm-fixed / reopen semantics | P0 | M5 | Deployed | prod | `tenant-work-orders.ts:356-458` | | |
| LIF-005 | Reopen clears stale `completedAt` | P1 | M5 | In review | — | **FIXED** `tenantReopen` sets `completedAt: null`; test `m5-completion` | | not deployed |
| LIF-006 | Cancelled + duplicate handling | P1 | M5 | Partial | prod | cancelled terminal | | |
| LIF-007 | `blockedReason` populated (waiting_tenant/vendor/other) | P1 | M5 | In review | — | `updateWorkOrderStatus` sets `blockedReason` on block (input); test `m5-completion` | | activates dormant tenant labels |
| LIF-008 | Reconcile duplicated client transition table | P1 | M5 | Defective | prod | drift `entity-drawer.tsx:1040-1046` | | derive from contract |

## SUM — completion summary
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| SUM-001 | Structured completion record | P0 | M5 | In review | — | `completion.ts` `buildCompletionSummary` captured on resolve → `work_orders.completion_summary`; test `m5-completion` | LIF-004, ATT-010 | deterministic (no AI) |
| SUM-002 | Summary preserved + tenant-visible | P0 | M5 | In review | — | jsonb persisted; tenant-safe fields (completedAt/technician) surfaced | TEN-008, EML-005 | ops/tech raw-summary view = follow-up |
| SUM-003 | Optional AI summary (labeled/grounded/non-required) | P2 | M9+ | Deferred | — | — | SUM-001 | LR-012 |

## EML — email notifications
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| EML-001 | New-submission email | P1 | M6 | Partial | prod | `wo_submitted` to tech `tenant-work-orders.ts:102` | | |
| EML-002 | Assignment/reassignment email | P1 | M6 | Partial | prod | `wo_assigned` | ASN-* | |
| EML-003 | New participant-visible message email | P1 | M6 | Partial | prod | `wo_message` | MSG-001 | |
| EML-004 | Status-change email (fix staff never-emails) | P1 | M6 | **In review** | — | FIXED — creator email resolved in-tx `work-orders.ts`; email channel now fires | | branded template + deep link |
| EML-005 | Completion email w/ summary | P1 | M6 | Backlog | — | — | SUM-002 | |
| EML-006 | Tenant confirmation / reopen email | P1 | M6 | Partial | prod | `wo_verified`/`wo_reopened` | | |
| EML-007 | Escalation/overdue email | P2 | M6 | Not-impl | — | none | ASN-005 | |
| EML-008 | Auth deep links + correct recipient + no cross-tenant leak | P1 | M6 | In review | — | absolute deep links via `email-templates.ts`; `absoluteUrl()` + CTA button; session-gated | | |
| EML-009 | Retry/idempotency (no uncontrolled duplicates) | P1 | M6 | In review | — | FIXED — `notifications.idempotency_key` + partial unique index (0017); per-channel dedupe in `dispatchInline` | | |
| EML-010 | Delivery logging + failure observability | P1 | M6 | Deployed | prod | status/error/providerMessageId | OBS-002 | |
| EML-011 | Templates + preferences/unsubscribe | P1 | M6 | Partial | prod | inline HTML `notifications.ts:335`; prefs table exists | | |
| EML-012 | Provider/SMTP secret via env (never committed) | P0 | M6 | Ready | prod | `RESEND_API_KEY` env | SEC-006 | verify prod key+domain |

## PUSH — push notifications (LAUNCH GATE)
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| PUSH-001 | Web push for supported devices | P0 | M7 | Partial | prod | real web-push `push.ts` | LR-008 | operational when VAPID set |
| PUSH-002 | Global SW registration + subscription lifecycle | P0 | M7 | In review | — | `ServiceWorkerRegister` registers per-surface on every load (not opt-in-only) | PWA-002 | subscription lifecycle unchanged |
| PUSH-003 | Foreground/background/closed/expired/revoked handling | P0 | M7 | Backlog | — | prune on 404/410 exists | | test matrix |
| PUSH-004 | Notification preferences | P1 | M7 | Partial | prod | `notification_preferences` | EML-011 | |
| PUSH-005 | Real iPhone + Android validation | P0 | M7 | Backlog | — | none | | launch gate |
| PUSH-006 | Push equivalents of email events | P1 | M7 | Partial | prod | some kinds push | EML-* | |

## PWA — installable app (LAUNCH GATE)
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| PWA-001 | Manifest icons + assets | P0 | M7 | **In review** | — | FIXED — generated icon set (192/512/maskable-512/apple-touch-180) via `scripts/gen-pwa-icons.mjs`; manifest + layout wired; `manifest.test.ts` asserts install contract | | |
| PWA-002 | Service worker (offline messaging min) | P1 | M7 | In review | — | `sw.js`+`tenant-sw.js` now precache offline shell + network-first navigations → `offline.html`; global registration | | never caches authenticated HTML (RLS safety) |
| PWA-003 | Safe areas, large touch targets, branding | P1 | M7 | Partial | prod | mobile shells exist | | |
| PWA-004 | Installable on iOS/Android | P0 | M7 | In review | — | code-complete (icons + SW + registration); **on-device install still needs real iPhone/Android** | PWA-001 | launch gate — device validation |
| PWA-005 | Persistent secure sessions on device | P1 | M7 | Deployed | prod | 30-day cookies | AUTH-003 | |

## LOC — commercial location & company model
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| LOC-001 | `buildings` table | P0 | M3 | In review | — | pragmatic: `properties` = building (see LR-011 impl note) | LR-011 | not deployed |
| LOC-002 | `floors` table | P0 | M3 | In review | — | `units.floor` column (migration 0015) | LOC-001 | not deployed |
| LOC-003 | `suites` table (or unit extension) | P0 | M3 | In review | — | `units.suite` column; unit = suite | LOC-002 | not deployed |
| LOC-004 | `tenant_companies` table + membership | P0 | M3 | In review | — | `tenant_companies` table + `tenant_users.company_id` `commercial.ts` | LR-011 | not deployed |
| LOC-005 | Tenant user → company + suite + building mapping | P0 | M3 | In review | — | `company_id` + unit→property; session-derived | LOC-003/004 | not deployed |
| LOC-006 | Building-level routing ownership | P0 | M3 | In review | — | `properties.defaultAssigneeUserId` + org fallback | ASN-002 | not deployed |
| LOC-007 | Migration + backfill from flat model | P0 | M3 | In review | — | migration 0015 (additive; no backfill needed) | LOC-001..005 | not deployed |
| LOC-008 | RLS policies for new location tables | P0 | M3 | In review | — | staff_org on `tenant_companies`+`org_settings`; test `m3-routing` | SEC-004 | not deployed |

## ADM — admin & technician management
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| ADM-001 | Add/manage technicians | P1 | M3 | Backlog | — | none | TEC-001 | |
| ADM-002 | Configure buildings/floors/suites/companies | P1 | M3 | Backlog | — | property/unit admin exists | LOC-* | |
| ADM-003 | Configure ownership rules + notification recipients | P1 | M3 | Partial | prod | "Covered by" dropdown | ASN-002/003 | |
| ADM-004 | Manage categories | P1 | M2 | Partial | prod | contract-coded | | add commercial cats |
| ADM-005 | Manage external vendors + COIs | P2 | M9 | Deployed | prod | vendors/COI admin | VEN/COI | |
| ADM-006 | Search/filter/sort/report across portfolio | P1 | M8 | Deployed | prod | `/work`, exports | | verify for Lucid scale |
| ADM-007 | Role-boundary enforcement (no internal/financial exposure) | P0 | M4 | In review | — | tech surface scoped to own assignments; role-based landing → `/tech` | SEC-002 | operator-route blocking for techs = follow-up |

## VEN / COI — external vendors (post-pilot)
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| VEN-001 | External vendor accounts/secure access | P2 | M9 | Deployed | prod | `vendor_users` magic-link | | |
| VEN-002 | Assignment acceptance | P2 | M9 | Partial | prod | vendor portal read-only | | |
| VEN-003 | Vendor details/messaging/status/photos/completion | P2 | M9 | Partial | prod | partial vendor portal | | |
| VEN-004 | Vendor notification emails | P2 | M9 | Partial | prod | `wo_assigned` to vendor | | |
| VEN-005 | Role isolation (vendor ≠ internal tech) | P0 | M9 | Deployed | prod | separate identity/RLS | LR-005 | |
| VEN-006 | Vendor org + technician membership | P2 | M9 | Deployed | prod | `vendors`/`vendor_users` | | |
| VEN-007 | Easier COI access from vendor area | P2 | M9 | Backlog | — | COI in admin | | |
| COI-001 | COI visibility + expiration state | P1 | M9 | Deployed | prod | `compliance.ts`; sweep | | |
| COI-002 | Assign-gate on expired COI | P1 | M9 | Deployed | prod | `work-orders.ts:379-407` | | |
| COI-003 | COI upload + record | P1 | M9 | Deployed | prod | `coi-record-form.tsx` | | |

## OBS — observability, CI & release engineering
| ID | Requirement | Pri | M | Status | Deploy | Code / Evidence | Deps | Notes |
|---|---|---|---|---|---|---|---|---|
| OBS-001 | CI pipeline (typecheck/lint/test/RLS/e2e gate) | P1 | M0 | In review | — | `.github/workflows/ci.yml`; PR #2 green | | DB integration+RLS job **runs + passes** on PR #2 (30 files/212 tests, incl. `rls`/`tenant-rls`, vs isolated `stack_os_ci`); branch-protection required-check pending (plan-gated); e2e excluded |
| OBS-002 | Error tracking (Sentry or equiv) | P1 | M0 | In progress | — | `web/src/instrumentation.ts` → `logger.ts` seam | OBS-003 | baseline via Vercel logs; Sentry vendor deferred (manual steps in RELEASE_CHECKLIST) — LR-013 |
| OBS-003 | Structured logging | P1 | M0 | In review | — | `logger.ts`; `instrumentation.ts`; wired `notifications.ts`+`db.ts`; tests `test/unit/logger.test.ts` | | redaction covered by automated tests |
| OBS-004 | Health check w/ dependency checks | P1 | M8 | Partial | prod | `api/health` + `api/health/ready` (config presence); tests `test/unit/health-ready.test.ts` | | DEEP DB/storage/email checks remain M8 |
| OBS-005 | Migration application in deploy pipeline | P1 | M0 | In progress | — | CI job runs `db:migrate` against isolated `stack_os_ci` (verified on PR #2) | OBS-001, LR-013 | prod deploy auto-apply still deferred (LR-013) |
| OBS-006 | Production smoke tests | P1 | M8 | Partial | — | `scripts/p2-smoke.ts` legacy | | refresh for Lucid loop |
| OBS-007 | Backups + rollback procedure | P1 | M8 | Backlog | — | Neon PITR assumed | | document + test |

---

**Counts:** AUTH 8 · IDN 4 · SEC 7 · TEN 10 · ASN 8 · MSG 10 · ATT 10 · TEC 13 ·
LIF 8 · SUM 3 · EML 12 · PUSH 6 · PWA 5 · LOC 8 · ADM 7 · VEN 7 · COI 3 · OBS 7 =
**136 tracked requirements.** Confirmed defects (P0/P1): ASN-001, MSG-001,
MSG-010, EML-004, EML-009, LIF-005, LIF-008, PWA-001.
