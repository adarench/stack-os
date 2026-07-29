# Stack OS — Tenant iOS App: Packaging & App Store Submission

**Owner:** Stack OS · **Status:** repo-complete; needs a Mac + Apple Developer account to build/sign/submit · **Date:** 2026-07-29

Everything that can be built without the client's Apple account is in the repo
(`mobile/`). This is the packaging approach, the exact build steps, the App Store
metadata, and precisely what Stack must supply.

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
uploaded, or submitted — those require the Apple account + a Mac with Xcode. The
repo (`mobile/`) contains the config, assets, deps, and these exact steps so a
developer can complete it in an afternoon once the account exists.
