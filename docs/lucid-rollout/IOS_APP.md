# Stack OS — Tenant iOS App: Packaging & App Store Submission

**Owner:** Stack OS · **Status:** native project **generates cleanly**; needs **full Xcode** (build) + an **Apple Developer account** (sign/APNs/submit) · **Date:** 2026-07-29

Everything that can be built without the client's Apple account is in the repo
(`mobile/`). This is the packaging approach, the exact build steps, the App Store
metadata, and precisely what Stack must supply.

## 0. Build validation (2026-08-17) — verified building + running

Run on this macOS machine (**Xcode 26.6 / iOS SDK 26.5** — a currently-accepted
App Store SDK):

| Step | Result |
|---|---|
| `npm install` in `mobile/` | ✓ Capacitor deps resolve (`ios`, `camera`, `push-notifications`, `splash-screen`) |
| `capacitor-assets generate` | ✓ app icons + launch/splash generated into the project |
| `cap sync ios` | ✓ web assets + 4 plugins copied; `pod install` runs |
| Info.plist permissions | ✓ camera + photo-library usage strings + `ITSAppUsesNonExemptEncryption=false` present |
| `xcodebuild … -sdk iphonesimulator clean build` | ✓ **BUILD SUCCEEDED, 0 errors** (no signing needed for simulator) |
| Launch on iPhone 17 Pro simulator | ✓ installs, launches, **loads the production Resident portal over HTTPS** (ATS + `allowNavigation` OK); sign-in renders |
| Built bundle config | ✓ `Stack OS` · `us.stackstorage.tenant` · `1.0.0`/`1` · permission strings baked in |

**Build stage reached: `simulator-build` (compiles + runs).** The native project
is now **committed** (`mobile/ios/`, Pods excluded) so the submission config —
Info.plist permissions, bundle id, version — is reproducible and can't be lost on
regeneration. On the build Mac: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
(activate Xcode) → `pod install` in `mobile/ios/App` → open `App.xcworkspace`.

**Not yet done (needs Stack's Apple credentials):** signing, archive, upload,
Submit for Review. The interactive reviewer path (login → submit a WO → attach a
photo → completion) is the same web app rendered in the WKWebView — verified at
the web/DB level (demo login authenticates; 8 seeded WOs visible with photos +
conversations) — but a manual tap-through login on the simulator/device is the
remaining human check, and is how the populated App Store screenshots get taken.

## 1. Packaging approach (and why)

**Capacitor shell around the production tenant PWA** (`mobile/capacitor.config.ts`).
A native rewrite is not warranted — the tenant experience already works, so the
iOS app loads it live (`https://stack-os-six.vercel.app/tenant`) inside WKWebView
and layers on the native pieces Apple expects:

- **Native launch screen + app icon** (dark brand, generated in `mobile/resources`).
- **Camera / photo-library capture** for request photos (`@capacitor/camera`).
- **Push notifications** (`@capacitor/push-notifications`) — same VAPID backend.
- **Navigation pinned to our host** (`allowNavigation`) so it can't wander off-site.
- **Session** = the same secure, HTTP-only cookie the browser uses — works in
  WKWebView (same origin); no password is ever stored in the app.

This is the fastest safe path that preserves the shipped workflow and gives a
coherent app (not a bare link to a website). Apple guideline 4.2 is addressed by
the native icon/splash/push/camera integration + the app's real utility
(submitting + tracking maintenance requests) — called out in the reviewer notes.

## 2. Verified tenant flow (works today in the browser; identical in the shell)

Login (email/password) · durable session across relaunch (30-day cookie) ·
password reset (`/tenant/forgot`) · submit a request with category/location/photo ·
request history + status · tenant-facing messages + completion (tenant-safe, no
internal notes) · logout · mobile layout with safe areas. Push + camera become
native via the plugins on top.

## 3. App identity & config

| Field | Value |
|---|---|
| App name | **Stack OS** |
| Bundle ID | `us.stackstorage.tenant` |
| Version / Build | `1.0.0` / `1` |
| Deployment target | iOS 15+ |
| Orientation | Portrait |
| Background/brand | `#0a0a0a` |

### Info.plist keys (set in Xcode after `cap add ios`)
- `NSCameraUsageDescription` — "Stack OS uses the camera so you can add a photo to a maintenance request."
- `NSPhotoLibraryUsageDescription` — "Stack OS lets you attach photos from your library to a maintenance request."
- Push: enable the **Push Notifications** capability + **Background Modes → Remote notifications**.
- (Optional) Associated Domains `applinks:stack-os-six.vercel.app` for deep links.

## 4. Build steps (on a Mac with Xcode + CocoaPods)

```bash
cd mobile
npm install
npm run add:ios          # npx cap add ios  → generates the ios/ Xcode project
npm run assets           # capacitor-assets → icon + splash sets from mobile/resources
npm run sync             # copy config + plugins into the native project
npm run open             # open ios/App/App.xcworkspace in Xcode
# In Xcode: set the Team (Apple account), add the Info.plist keys + capabilities
# above, then Product → Archive → Distribute → App Store Connect.
```

## 5. App Store Connect metadata (drafts)

- **Name:** Stack OS
- **Subtitle:** Maintenance requests, handled
- **Promotional text:** Report an issue in seconds and track it to done.
- **Description:**
  > Stack OS is the resident app for maintenance at your building. Snap a photo,
  > describe the issue, and submit — it routes straight to the on-site team. Track
  > status, message the technician, and get a clear summary when it's fixed. Sign
  > in with the email and password your property manager set up.
- **Keywords:** maintenance,work order,property,repair,facilities,tenant,resident,building,request,service
- **Support URL:** https://stack-os-six.vercel.app/support *(create this page, or use a mailto)*
- **Privacy Policy URL:** https://stack-os-six.vercel.app/privacy *(a public policy already exists in the app — confirm the path)*
- **Category:** Productivity (secondary: Business)
- **Age rating:** 4+

### App Privacy (data collection) answers
Collects: email + name (account), maintenance request content + photos, usage
diagnostics. Not used for tracking. Not sold. Used to operate the service.

### Reviewer notes
> Stack OS is a B2B resident maintenance app. Test account below is a real resident
> in a demo building. Flow to review: sign in → "New request" → pick a category →
> add a photo → submit → see it in the list with status. The app is a native shell
> over our authenticated web app; it adds native camera capture and push
> notifications and is pinned to our domain.

### Demo/test account for Apple review
- URL: https://stack-os-six.vercel.app/tenant
- Email: `slumpkins@lucidchart.com` — Password: *(provide the current one; reset via `/tenant/forgot` if needed)*

## 6. Submission checklist
- [ ] Apple Developer Program enrollment complete (Stack's account).
- [ ] App ID `us.stackstorage.tenant` + Push capability created in the portal.
- [ ] Signing cert + provisioning profile (Xcode-managed is fine).
- [ ] `cap add ios` + assets + Info.plist keys + capabilities done.
- [ ] APNs key uploaded (for production push) + matched to the VAPID/web-push path if using web push in the shell, or native push via `@capacitor/push-notifications`.
- [ ] Screenshots (6.7" + 6.5" + 5.5") captured from the running app.
- [ ] Privacy policy + support URLs live.
- [ ] App Privacy questionnaire completed.
- [ ] TestFlight internal test, then submit for review.

## 7. What Stack must supply (I cannot)
1. **Apple Developer Program account** (Team ID) + agree to agreements.
2. **Signing** — done in Xcode with that account (certs/profiles).
3. **APNs key** for production push (if native push).
4. Final **support** + **privacy-policy** URLs (confirm the in-app privacy page path).
5. The **actual Archive → submit** action from the authorized account.

**Not done / not claimed:** the app has **not** been built into an `.ipa`, signed,
uploaded, or submitted — those require the Apple account + a Mac with **Xcode.app**
(Command Line Tools are not enough). The repo (`mobile/`) contains the config,
assets, deps, and these exact steps, and the native project now **generates +
resolves pods cleanly**, so a developer can complete it in an afternoon once the
account exists.

## 8. Native push (APNs) — BUILT (stub-until-keyed); needs the Apple key + a device

**Status (2026-07-30): the backend + app registration are implemented and deployed.**
`tenant_device_tokens` table (migration 0022, RLS-forced), `apns.ts` token-auth
sender (ES256 JWT over HTTP/2), `/api/tenant/push/apns` register/unregister,
dispatcher fan-out to device tokens, and `NativePushRegister` in the tenant shell.
It runs as a **stub no-op until the APNs key is configured**, then goes live with
**no code change**. Remaining to actually deliver a push to a phone:

1. **In Xcode:** enable the **Push Notifications** capability + **Background Modes →
   Remote notifications** (§3).
2. **In the Apple developer portal:** create an **APNs auth key** → download the
   `.p8`, note its **Key ID** + your **Team ID**.
3. **Set env (Vercel, server-side):**
   - `APNS_KEY` = the `.p8` file contents (PEM) · `APNS_KEY_ID` · `APNS_TEAM_ID`
   - `APNS_BUNDLE_ID=us.stackstorage.tenant` · `APNS_PRODUCTION=1` (or leave unset for sandbox during dev)
4. Run the app on a **physical iPhone** (simulators can't receive APNs), accept the
   permission prompt, then trigger a WO status change → the push should arrive and
   deep-link into the request.

The original design (now implemented) followed below for reference:

1. **Capability + entitlement:** in Xcode add **Push Notifications** + **Background
   Modes → Remote notifications**; the generated `Info.plist`/entitlements get
   `aps-environment`.
2. **Registration (shell):** on launch/login, `PushNotifications.requestPermissions()`
   → `register()` → the `registration` event yields the APNs **device token**.
3. **Token storage (backend, new):** a `device_tokens` table
   (`org_id, tenant_user_id | user_id, token, platform, last_seen_at, deleted_at`),
   RLS-scoped like `tenant_push_subscriptions`; a `POST /api/tenant/push/apns`
   route (session-gated) upserts by token; **delete on logout** (mirror the web-push
   cleanup already shipped).
4. **Send path (backend, new):** an APNs HTTP/2 sender authenticated with the **`.p8`
   key** (JWT `ES256`), added as a channel in `dispatchInline` alongside web push,
   reusing the same `{title, body, url, tag}` payload → `aps` + a `data.url` for the
   deep link.
5. **Deep link:** the shell handles `pushNotificationActionPerformed` and routes the
   WKWebView to `data.url` (`/tenant/WO-<n>`).
6. **Token refresh / multi-device:** re-register on each launch (tokens rotate);
   store per-device; prune on APNs `410`/`Unregistered`.

**Requires from Apple (cannot proceed without):** APNs auth key (`.p8`) + Key ID +
Team ID. Everything else above is ordinary app + backend code.
