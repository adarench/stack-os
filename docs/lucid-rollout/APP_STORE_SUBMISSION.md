# Stack OS — iOS App Store Submission Runbook (ready-to-paste)

**Audience:** whoever has the Mac + Apple Developer account. Everything here is
copy-paste; you shouldn't have to *decide* anything, only *do* it. Detail/why is
in [`IOS_APP.md`](./IOS_APP.md); this is the execution checklist.

**What the app is:** a Capacitor native shell (`mobile/`) around the live tenant
PWA. It loads `stack-os-six.vercel.app/tenant` in a native WKWebView and adds
camera capture + push. No separate backend — the app is the web app.

**App identity (already set — don't change):**

| Field | Value |
|---|---|
| App name | `Stack OS` |
| Bundle ID | `us.stackstorage.tenant` |
| Version / Build | `1.0.0` / `1` |
| Deployment target | iOS 15+ · Portrait only · brand `#0a0a0a` |
| Category | Productivity (secondary: Business) · Age 4+ |

---

## Prerequisites (only Stack can provide — see §5)
- [ ] Apple Developer Program enrollment complete (Team ID in hand)
- [ ] A Mac with **full Xcode.app** installed (Command Line Tools alone are not enough)
- [ ] CocoaPods installed (`sudo gem install cocoapods` or `brew install cocoapods`)

---

## Part A — Build & configure in Xcode

> **State:** the native iOS project is **committed** (`mobile/ios/`, Pods excluded)
> and a clean simulator build is **verified** (BUILD SUCCEEDED, 0 errors; app
> launches + loads the production Resident portal). Do **NOT** run `cap add ios`
> — it would overwrite the committed Info.plist (camera permissions) + config.

### A1. Prepare the project (deps only — project already exists)
```bash
# One-time: point the toolchain at Xcode (not Command Line Tools)
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

cd mobile
npm install
npm run sync                 # cap sync ios (copies web + plugins, runs pod install)
# If pods didn't install:  (cd ios/App && pod install)
npm run open                 # opens ios/App/App.xcworkspace in Xcode
```

### A2. Signing (Xcode → target "App" → Signing & Capabilities)
- [ ] **Team:** select Stack's Apple Developer team
- [ ] **Automatically manage signing:** ON (Xcode creates the cert + profile)
- [ ] Confirm **Bundle Identifier** reads `us.stackstorage.tenant`

### A3. Capabilities (same tab → "+ Capability")
- **v1 ships without native push** (APNs isn't keyed — the app has no push in v1;
  residents still get email + SMS). So **do not add** the Push Notifications
  capability for the first submission — it would require an APNs-enabled App ID +
  entitlement and add avoidable review friction. (To add push later, see Part C.)
- *(optional, for universal links)* **Associated Domains** →
  `applinks:stack-os-six.vercel.app`

### A4. Info.plist — already set (verify only)
These are **committed** in `mobile/ios/App/App/Info.plist` and confirmed in the
built bundle — no need to paste; just confirm they're present:

```xml
<key>NSCameraUsageDescription</key>
<string>Stack OS uses the camera so you can add a photo to a maintenance request.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Stack OS lets you attach photos from your library to a maintenance request.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Stack OS can save photos you capture for a maintenance request.</string>
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

> `ITSAppUsesNonExemptEncryption=false` (the app only uses standard HTTPS)
> pre-answers the export-compliance question and avoids a submission prompt.

### A5. Archive & upload
- [ ] Xcode toolbar: set the run destination to **Any iOS Device (arm64)**
- [ ] **Product → Archive**
- [ ] In the Organizer: **Distribute App → App Store Connect → Upload**
- [ ] Let Xcode manage signing; upload symbols when asked

---

## Part B — App Store Connect (copy-paste every field)

Create the app at appstoreconnect.apple.com → Apps → **+** → New App
(Platform iOS, Name `Stack OS`, Primary language English (U.S.), Bundle ID
`us.stackstorage.tenant`, SKU `stack-os-tenant`).

### B1. App information
| Field | Value |
|---|---|
| **Name** | `Stack OS` |
| **Subtitle** | `Maintenance requests, handled` |
| **Category** | Primary: **Productivity** · Secondary: **Business** |
| **Age rating** | 4+ (answer "None" to all content questions) |

### B2. Version 1.0 — listing
**Promotional text**
```
Report a maintenance issue in seconds and track it all the way to done.
```

**Description**
```
Stack OS is the resident app for maintenance at your building. Snap a photo,
describe the issue, and submit — it routes straight to the on-site team.

• Submit a request in seconds with a photo and a category
• Track status from submitted through completed
• Message the technician right on the request
• Get a clear summary when it's fixed, and reopen it if it isn't
• Stay posted by push, email, and text

Sign in with the email and password your property manager set up.
```

**Keywords** (100-char limit — this fits)
```
maintenance,work order,property,repair,facilities,tenant,resident,building,request,service
```

**Support URL** → `https://stack-os-six.vercel.app/support`
**Marketing URL** *(optional)* → `https://stack-os-six.vercel.app`
**Privacy Policy URL** → `https://stack-os-six.vercel.app/privacy`

> All three URLs are live and public (no login), Stack-branded, verified 200
> (2026-08-17).

### B3. Screenshots (required)
Capture from the running app. Apple's current minimum is one **6.9"/6.7"** set
(iPhone 17 Pro Max / 16 Pro Max); a 6.5" set is optional.

**How to capture** (the app is already installed on the iPhone 17 Pro simulator
from the build verification): sign in as the demo account (Part B5) to populate
real content, then for each screen run:
```bash
xcrun simctl io booted screenshot ~/Desktop/shot-<name>.png
```
Suggested 4 shots (all present in the seeded demo account):
**request list · a completed request with photo + timeline · the message thread ·
the new-request form.**

> The sign-in screen is already verified rendering in the simulator; the four
> populated shots need a one-time manual login (the demo credentials are in B5).

### B4. App Privacy questionnaire (Apple's exact structure)
Data collected → **Yes**. For each type below: *Linked to identity = Yes;
Used for tracking = No; Purpose = App Functionality* (and Customer Support where
noted).

| Data type | Collected | Notes |
|---|---|---|
| **Contact Info** → Email Address | Yes | account sign-in |
| **Contact Info** → Name | Yes | account / attribution |
| **Contact Info** → Phone Number | Yes | SMS notifications (opt-out via STOP) |
| **User Content** → Photos or Videos | Yes | photos attached to a request |
| **User Content** → Other (request text) | Yes | the maintenance request description/messages |
| **Identifiers** → Device ID (push token) | Yes | to deliver push notifications |
| **Diagnostics** → Crash / Performance | Optional | only if you keep default diagnostics |

- **Used for tracking:** **No** for everything (no cross-app/− data-broker use).
- **Data sold:** **No.**

### B5. Reviewer notes (App Review Information → Notes)
```
Stack OS is a B2B resident maintenance app — a native shell over our
authenticated web app (WKWebView pinned to stack-os-six.vercel.app), adding
native camera capture and push notifications.

Flow to review:
1. Sign in with the demo account below.
2. The account already contains a full history — completed, open, and
   in-progress maintenance requests across Electrical, Plumbing, HVAC, and
   General, with photos, conversations, and status timelines, plus an active
   renter's-insurance policy on the coverage screen.
3. Open any request to see its detail, message thread, and photos. Tap
   "New request" to submit one (pick a category, add a photo, submit).

The app requires an account created by a property manager; the demo account is a
real resident in a demo building so all features are exercisable. Sign-in is
email + password only — no MFA, magic link, or email verification needed.
```

**Demo account** (App Review Information → Sign-In required: **Yes**) — a
permanent, idempotent seed (`pnpm --filter web db:seed:apple-review`; re-run
after any DB reset). Isolated in its own demo org — never touches real tenant data.
```
URL:      https://stack-os-six.vercel.app/tenant
Email:    apple-review@bedrockwork.ai
Password: Review2026!    (overridable via APPLE_REVIEW_PASSWORD; re-seed if changed)
```
> The seed sets this password (bcrypt-hashed). It works immediately after the
> seed runs — no reset, MFA, magic link, or admin approval. The email is a pure
> login credential (no mail is ever sent to it). Re-run the seed after any
> database migration/reset so the account always exists.

### B6. Release settings (Version → the 1.0 version)
- **Version number:** `1.0.0` · **Build:** `1` (matches the project).
- **Release:** choose **"Automatically release this version"** (goes live on
  approval) — or **"Manually release"** if you want to control the go-live moment.
- **Phased release:** optional (gradual rollout over 7 days); fine to leave off for v1.
- **Content Rights:** does not use third-party content → No.
- **Export compliance:** already answered by `ITSAppUsesNonExemptEncryption=false`
  in Info.plist (standard HTTPS only) → no prompt.
- **Pricing:** Free.
- **Availability:** all territories (or restrict as desired).

### B7. Submit
- [ ] Attach the uploaded build to the 1.0.0 version
- [ ] *(recommended)* TestFlight → add yourself as an internal tester, install,
      run the reviewer flow once on a real device
- [ ] **Add for Review → Submit**

---

## Part C — Native push (optional for v1; flips on with no code change)

The backend, device-token storage, and app registration are **already built and
deployed** — push runs as a no-op until the APNs key is set, then goes live.
You can ship v1 **without** it (residents still get email + SMS + web-push) and
turn it on in a point release, or include it now.

To turn it on:

1. **Apple Developer portal → Keys → +** → enable **Apple Push Notifications
   service (APNs)** → download the `.p8` (you can only download once). Note the
   **Key ID** (10 chars) and your **Team ID**.
2. **Vercel → Project → Settings → Environment Variables → Production**, add:

   | Variable | Value |
   |---|---|
   | `APNS_KEY` | full `.p8` contents (`-----BEGIN PRIVATE KEY-----…`) |
   | `APNS_KEY_ID` | the 10-char Key ID |
   | `APNS_TEAM_ID` | your Apple Team ID |
   | `APNS_BUNDLE_ID` | `us.stackstorage.tenant` |
   | `APNS_PRODUCTION` | `1` |

3. Redeploy. First real device that opens the app registers its token; the next
   notification delivers natively. Verify by watching `tenant_device_tokens` gain
   a row, then triggering a WO status change for that resident.

> Mark it live only after a notification is observed **on a real device** — a
> stored token is not proof of delivery.

---

## Part D — What remains (only these need Stack's Apple credentials)

**Done / verified (in the repo + prod):** Stack OS branding resolved; live +
Stack-branded support/privacy/terms URLs; permanent demo review account
(`apple-review@stackwithus.com`) with seeded history (verified login + 8 WOs);
committed native iOS project (bundle id, version 1.0.0/1, Info.plist camera
permissions); **clean simulator build succeeds and the app launches + loads the
production tenant app**; all App Store Connect listing copy, privacy answers,
reviewer notes, and release settings drafted below.

**Remaining — all require the Apple account under `adam.rencher12@gmail.com`:**
1. **Enroll in the Apple Developer Program** (Team ID) + accept agreements — the
   long pole; ~1–3 days for identity verification.
2. **Sign** the build in Xcode with that account (Automatically manage signing).
3. **Archive → Upload** to App Store Connect (Any iOS Device destination).
4. **Capture the 4 populated screenshots** after a one-time manual login (B3).
5. **Submit for Review.**
6. *(optional, post-v1)* APNs `.p8` key to enable native push (Part C).

Not blocking, already handled: Xcode 26.6 / iOS SDK 26.5 installed; CocoaPods
resolved; export-compliance pre-answered. The only new thing to *decide* is
whether to confirm the demo password (it's set by the seed — works as-is).

**Realistic timeline:** Apple enrollment (~1–3 days, identity check) → build +
archive (~an afternoon) → optional TestFlight → App Review (typically 1–3 days).
The bottleneck is the Apple account, not the code.
