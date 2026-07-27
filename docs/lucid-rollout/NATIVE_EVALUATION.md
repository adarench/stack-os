# Native App Evaluation (M10)

**Owner:** Stack OS · **Status:** Recommendation — **defer native; ship the PWA
for the Lucid pilot** (aligns with decision **LR-010**). **Update freq:** revisit
after the pilot, or if a hard blocker below is hit. **Last updated:** 2026-07-27.

This is a decision memo, not an implementation. It answers: *should the Lucid
rollout be a web PWA or a native iOS/Android app?* — for the three actors
(Lucid employee/resident, technician, operator).

---

## Recommendation

**Ship the installable PWA (M7) for the pilot. Do not build native yet.** Re-open
the native question only on evidence from the pilot (see triggers). The PWA
covers the canonical loop end-to-end today (proven by AT-CANONICAL), installs to
the home screen on iOS + Android, works offline for the shell, and supports web
push. Native's remaining advantages don't justify its cost until the pilot shows
a concrete need.

---

## What the PWA already gives us (M7)

- **Installable** on iOS (Add to Home Screen) and Android (WebAPK/install prompt)
  — branded icons, standalone display, offline shell. See `manifest.webmanifest`,
  `sw.js` / `tenant-sw.js`, `PWA-*` in the tracker.
- **Web push** on Android (fully) and iOS 16.4+ (**only** for a Home-Screen-
  installed PWA). Wired in `push.ts`; needs VAPID keys + on-device validation.
- **One codebase, instant deploys**, no App Store / Play Store review latency,
  no per-release binary — a decisive advantage during a fast-moving pilot.
- **No install friction** for a first look: a link opens the app; install is
  optional.

## Where native is genuinely better

| Capability | Native | PWA today | Matters for Lucid pilot? |
|---|---|---|---|
| iOS push without install | ✅ | ❌ (must Add to Home Screen first) | **Maybe** — the biggest real gap; mitigated by a guided install step |
| Background location / geofencing (tech en-route) | ✅ | ❌ | No — not in scope |
| Deep camera/scanner, barcode, LiDAR | ✅ | Partial (file/camera input works) | No — photo capture already works via web |
| App Store presence / MDM distribution | ✅ | ❌ | **Maybe** — only if Lucid mandates MDM-managed apps |
| Biometric unlock, secure enclave | ✅ | Partial (WebAuthn) | No |
| Reliability of push delivery | High | Good-when-installed | Watch during pilot |

## The one real risk: iOS push requires install

On iOS, web push **only** works after the user adds the PWA to the Home Screen.
Mitigation already in the product direction: a **guided install step** for
technicians and residents at onboarding (the launch gate already requires
on-device validation). If pilot data shows residents won't install and missed
push notifications hurt response time, that is the strongest single argument for
a native tech/resident app — reassess then.

## Cost of going native (rough order-of-magnitude)

- **Rebuild or wrap:** either a React Native/Expo rewrite of the mobile surfaces
  (weeks) or a Capacitor/Trusted-Web-Activity wrapper around the existing PWA
  (days, but inherits the PWA's capabilities — so it mainly buys store presence +
  iOS-push-without-install, not much else).
- **Store operations, ongoing:** Apple Developer + Play accounts, review cycles,
  release management, crash/version fragmentation, forced-update handling.
- **Auth/session parity** across a native shell + the existing cookie sessions.
- **Two release trains** if native and web diverge.

For a single-tenant pilot this is a poor trade versus iterating the PWA.

## Recommended path

1. **Pilot on the PWA** with a guided Home-Screen install for techs + residents.
2. Instrument install rate + push-delivery/-open rate + "missed update" reports.
3. If **and only if** a trigger below fires, evaluate a **Capacitor/TWA wrapper**
   first (cheapest path to store presence + iOS push without the ATHS step),
   before considering a full native rewrite.

## Re-open triggers (revisit this decision if any occur)

- Residents/techs **won't install** the PWA and missed push measurably slows
  response time.
- Lucid (or a future client) **requires MDM / App Store** distribution.
- A needed capability is **web-impossible** (background location, deep hardware).
- Push **reliability** on installed iOS PWAs proves inadequate in the field.

## Related

Decisions: **LR-004** (technician = mobile web/PWA), **LR-010** (native deferred),
**LR-008** (push is a launch gate). Launch-gate status: `PWA-*`, `PUSH-*` in
[`REQUIREMENTS_TRACKER.md`](./REQUIREMENTS_TRACKER.md).
