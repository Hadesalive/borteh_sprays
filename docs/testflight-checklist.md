# Borteh Sprays — TestFlight readiness checklist

_Last updated 2026-07-20._ Status of every item Apple checks on an external-TestFlight build,
what's done in the repo, and what only you (the account holder) can do.

## Done in the repo

- **App icon** — was a blank white placeholder in `ios/…/AppIcon.appiconset`; replaced with the
  Borteh flower mark on brand paper. Also set `icon`/`adaptiveIcon`/`splash` in `app.json`, and
  generated `assets/{icon,adaptive-icon,splash-icon,notification-icon}.png` from your `logo a.png`.
- **In-app account deletion** (Guideline 5.1.1(v), the one hard blocker) — "Delete account" now
  lives in Profile with a two-tap confirm. Backed by `fn_delete_account()`
  (migration `20260720225811`): purges personal data, then either hard-deletes the login (no
  orders) or anonymizes + disables it (orders retained for records).
- **iOS privacy manifest** — declared in `app.json` under `ios.privacyManifests`
  (AsyncStorage → `CA92.1`, plus file-timestamp / boot-time / disk-space reasons). See the
  prebuild note below for it to reach the build.
- **Encryption flag** — `ITSAppUsesNonExemptEncryption=false` added to the native `Info.plist`
  and `app.json` (skips the export-compliance prompt each upload).

## Confirmed non-issues (from the audit)

- No `NS*UsageDescription` strings needed — the app only uses haptics + push; neither requires
  one. Push permission is requested in-context, not at cold launch.
- Phone+password only → **Sign in with Apple is not required**.
- Cash-on-delivery, physical goods → **no In-App Purchase required**; Monime is web/admin-only.
- No placeholder/dead-end screens; onboarding degrades gracefully offline.

## ⚠️ One mechanism step: prebuild

`ios/` is committed as a real Xcode project, so **`app.json` changes don't reach the iOS build on
their own.** Before the EAS build, run on your Mac:

```
cd mobile
npx expo prebuild -p ios --clean
```

This regenerates the native project from `app.json`, applying the **privacy manifest** and
**splash image** (and re-confirming icon + encryption flag). The project has no custom native
code, so `--clean` is safe. The icon and encryption flag are already patched into the committed
native project too, so even without prebuild those two are correct — but the **privacy manifest
only lands via prebuild** (or a manual `PrivacyInfo.xcprivacy` + Xcode "Copy Bundle Resources"
entry, which prebuild does for you).

## Owner-only actions (need your Apple account / secrets)

1. **Apple Developer Program** enrollment ($99/yr) + the app record in App Store Connect.
2. **EAS credentials + `projectId`** — run `eas init` (writes `extra.eas.projectId` to `app.json`)
   and `eas credentials` for the push key + distribution cert. Push notifications stay dormant
   until this is done.
3. **Privacy policy URL + support URL** — App Store Connect requires both even for external
   TestFlight. Host a simple page (what you collect: name, phone, delivery address, order
   history, scent preferences; where it goes: your Supabase; how to delete: in-app).
4. **App Privacy "nutrition label"** in App Store Connect — declare the above data types.
5. **Build + submit**: `eas build -p ios --profile production` then `eas submit -p ios`
   (create `eas.json` first, or let `eas build` scaffold it).
6. **Bump the Expo patch** (minor): `npx expo install --check` (expo 54.0.35 → 54.0.36).

## Database migrations to push (from your terminal)

`supabase db push` applies, in order:
- `20260720221809_recs_cold_start_correctness.sql` — ranking fixes (see below)
- `20260720225345_quiz_scent_prefs.sql` — the onboarding quiz's `fn_set_quiz_prefs`
- `20260720225811_account_deletion.sql` — `fn_delete_account`

Then verify: `node scripts/verify-recs.mjs` (expects the recs migration applied).
