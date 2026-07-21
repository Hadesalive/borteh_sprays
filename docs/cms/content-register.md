# Borteh mobile — content register

The map for the app-wide CMS: every user-visible, editable string / image / curated list in the
mobile app, with a proposed home (a structured table, or an `app_content` key). Compiled from a
full screen-by-screen audit (`mobile/app/**` + `mobile/components/**`).

**Scope rule.** Editable *content* only. Excluded: DB values (product/brand/collection names,
prices via `formatLe`), route strings, style tokens, Phosphor icon names, and logic enums
(`male`/`female`/`for_you`/`tearLeft`…). Accessibility labels are listed where they'd read oddly if
left un-updated, but are lower priority.

**Two homes:**
- **Structured tables** (the `tip`/`home_carousel` pattern) for ordered lists with images.
- **`app_content(key,…)`** for one-off strings, keyed `screen.slot`. Read in-app via
  `useContent(key, fallback)` — the current literal is always the bundled fallback.

Status: **Onboarding is already migrated** (structured `onboarding_slide` + `app_content`) as the
Phase-1 vertical slice. Everything below is the remaining backlog.

---

## Structured lists → their own tables

| List | Where | Values | Table |
|---|---|---|---|
| Onboarding slides | `app/onboarding.tsx` | 3 × (title, body, image) | `onboarding_slide` ✅ done |
| Popular searches | `app/search.tsx` L32 | Oud, Vanilla, Rose, Amber, Fresh, Lattafa, Khamrah | `popular_search` |
| Scent taste options | `components/ScentPicker.tsx` L10-15 | 40 notes (Oud…Vetiver) | `scent_option` (or reuse scent_note) |
| Scent-picker genders | `ScentPicker.tsx` L16-20 | "For men"/"For women"/"Anything" | `app_content` (3 keys) |
| Home hero fallback | `components/HomeHero.tsx` | 3 slides (label/title/cta/img) | already `home_carousel`; these are fallbacks |
| Collection fallbacks | `components/CollectionBand.tsx` | Summer, Date night, Oud lovers, Gourmand, Office, Signature | already DB (category); fallback copy only |
| Discount banner | `components/DiscountBanner.tsx` | "Limited offer", "Up to {n}% off", "Shop the sale", `sale-bg.jpg` | `promo_banner` (+ toggle) |

## Already DB-driven (LIVE) — formalize under one "App Studio" nav

These curated surfaces are already editable from the DB; the CMS work is to group their editors
under one nav, not to rebuild them:

| Surface | Table | Admin today |
|---|---|---|
| Home hero carousel | `home_carousel` | Storefront |
| Featured collections | `category` (`is_featured_home`, `cover_image_path`) | Collections |
| Featured brands | `brand` (`is_featured_home`, `logo_path`) | Brands |
| Shop-by-scent rail | `home_scent_family` | Storefront |
| Tips ("How to use Borteh") | `tip` | (reference impl) |
| Perfect pairs / combos | `combo` + `combo_item` | Combos |
| Notices / promos bulletin | `notification` (`fn_broadcast_notice`, has `image_path`) | Settings → Notices |
| Loyalty tiers & rates | `loyalty_tier`, `loyalty_config` | Settings → Loyalty |
| Store contact (WhatsApp) | `store_location.phone` | Settings → Store |

## `app_content` keys by screen

**Home** (`app/(tabs)/index.tsx`): `home.greeting.morning|afternoon|evening`; `home.hero.fallback_label|title|cta`; `home.rail.shop_by_note`; `home.rail.collections`; `home.rail.perfect_pairs`; `home.eyebrow.collection`; `home.browse_all` ("Browse all … fragrances").

**Shop** (`app/(tabs)/shop.tsx`): `shop.title`; `shop.tab.all|women|men|unisex`; `shop.chip.on_sale|in_stock`; `shop.empty.title|body|clear`.

**Search** (`app/search.tsx`): `search.placeholder`; `search.eyebrow.recent|popular|trending`; `search.empty.title|body`; `search.cancel`.

**Cart/Bag** (`app/(tabs)/cart.tsx`): `cart.title`; `cart.empty.title|body|cta`; `cart.row.subtotal|pair_savings|delivery|delivery_pending|total`; `cart.cta`.

**Saved** (`app/(tabs)/wishlist.tsx`): `saved.title`; `saved.empty.title|body|cta`; `saved.unresolved.title|body|cta`.

**Product** (`app/product/[slug].tsx`): `product.stock.in|low|out` (labels); `product.conc.EDC|EDT|EDP|Parfum|Extrait`; `product.gender.male|female|unisex`; `product.notfound.title|body|cta`; `product.section.notes|delivery|reviews`; `product.delivery.value` ("Freetown · cash on delivery"); `product.new_arrival`; `product.read_more|read_less`; `product.notify.on_list|prompt`; `product.combo.title` ("Complete the pair"); `product.similar.title`; `product.reviews.empty`; `product.cta.add|added|notify|will_notify`.

**Checkout** (`app/checkout.tsx`): `checkout.title`; `checkout.section.delivery|payment|summary`; `checkout.field.name|phone|landmark|notes` (label+placeholder); `checkout.payment.cod_title|cod_sub`; `checkout.coupon.placeholder|apply`; `checkout.points.use|approx`; `checkout.summary.pair_savings|discount|points|total`; `checkout.delivery_note`; `checkout.err.invalid_code|missing_fields|empty_bag|failed`; `checkout.cta.idle|placing`.

**Order** (`app/order/[id].tsx`): `order.placed.title|sub`; `order.details.title`; `order.row.savings|points|delivery|delivery_pending|total`; `order.deliver_to`; `order.push.title|body|cta`; `order.cta.continue`; `order.notfound`.

**Orders list** (`app/orders.tsx`): `orders.title`; `orders.empty.title|body`.

**Combo** (`app/combo/[slug].tsx`): `combo.the_pair`; `combo.total`; `combo.notfound.title|body|cta`; `combo.cta`.

**Pairs** (`app/pairs.tsx`): `pairs.title|subtitle`; `pairs.empty.title|body|cta`.

**Review** (`app/review.tsx`): `review.title`; `review.field.title|body` (label+ph); `review.cta.idle|submitting`; `review.helper`; `review.err.no_rating|failed`.

**Auth** — `login.tsx`: `login.title|subtitle`; `login.field.phone|password`; `login.forgot`; `login.cta.idle|busy`; `login.new_prompt|create_link`; `login.err.missing|bad_creds|failed`. `signup.tsx`: `signup.title|subtitle`; field labels/placeholders; `signup.referral.label|placeholder`; ctas + errors. `forgot-password.tsx`: `forgot.title|subtitle`; field labels; ctas + errors.

**Profile** (`app/profile.tsx`): `profile.name_fallback`; `profile.row.*` (Points, Leaderboard, Orders, Saved fragrances, Coupons, Notices, Invite friends, Scent preferences, How to use Borteh, Notification settings, Edit profile, WhatsApp); `profile.signout`; `profile.guest.title|body|cta|new_prompt|create_link`.

**Edit profile** (`app/edit-profile.tsx`): `editprofile.title`; field labels/ph; `editprofile.phone_help`; ctas + errors.

**Preferences** (`app/preferences.tsx`): `prefs.title|caption`; `prefs.push.title` + 3 captions; `prefs.offers.title|caption`; `prefs.privacy.eyebrow`; `prefs.leaderboard.title|caption`; guest empty.

**Scent preferences** (`app/scent-preferences.tsx`): `scentprefs.title|subtitle`; guest; cta states.

**Invite** (`app/invite.tsx`): `invite.title`; `invite.reward_line` (+ points variant); `invite.share_message`; `invite.hero.title|subtitle`; `invite.step1|step2|step3`; `invite.cta`; guest empty.

**Coupons** (`app/coupons.tsx`): `coupons.title|caption`; `coupons.empty.title|body|cta`; `coupons.terms.min|any`; `coupons.use`; guest empty.

**Points** (`app/points.tsx`): `points.title`; `points.card.member|brand|worth`; `points.eyebrow.how|history`; row copy (Every delivered order / Spend at checkout / A friend's first delivery / Leaderboard); tier & expiry lines; ledger labels; `points.cta.spend`; empty/guest.

**Leaderboard** (`app/leaderboard.tsx`): `leaderboard.title|caption`; `leaderboard.empty.title|body|cta`; `leaderboard.not_ranked`; guest.

**Notices** (`app/notices.tsx`): `notices.title|caption`; `notices.empty.title|body|cta`; `notices.eyebrow.offer|notice`; `notices.signature` ("— Borteh, Freetown").

**Notifications** (`app/notifications.tsx`): `notifs.title`; `notifs.mark_all`; `notifs.push.title|caption|cta`; `notifs.empty.title|body|cta`; guest.

**Shared components**: `TabBar` labels (Home/Shop/Saved/Bag); `ui.tsx` SearchBar placeholder; `NotificationToast` sender "Borteh"/"now"; `FeaturedCard` "Featured"/"Shop now"; `ComboRail` "See all"; `SortSheet` "Sort by" + `SORT_OPTIONS` labels (in `lib/search.ts`); `QuickPeek` "Details"/"Add to bag"/"Not interested". `SORT_OPTIONS` and `sortLabel()` live in `lib/search.ts`, not a screen.

## Bundled image inventory (fallbacks; DB images route through `imageUrl()`/`productImage()`/`brandLogo()`)

`assets/home/hero-oud.jpg`, `hero-gold.jpg`, `hero-rose.jpg`; `assets/home/scent/{woody,floral,oriental,spicy,citrus,sweet}.jpg`; `assets/home/collections/{summer,date-night,gourmand,office,signature}.jpg`; `assets/home/sale-bg.jpg`. No remote/hardcoded image path strings.

## Feature flags / config (Step 2, layer 3)

Small on/off switches — not copy. Suggested home: a single-row settings table (or reuse a
`loyalty_config`-style row) read by one `useFlags()` hook with bundled defaults (everything on), so
a missing row never hides a section.

| Flag | Controls |
|---|---|
| `home.leaderboard_band` | Show the leaderboard teaser band on Home |
| `home.section.shop_by_note` / `.collections` / `.perfect_pairs` | Toggle optional Home rails |
| `home.discount_banner` | Sale banner (currently auto — surface an override) |
| `home.seasonal` | Seasonal switch hook |
| loyalty / promos / tiers enabled | already `loyalty_config` booleans (LIVE) |
| per-user leaderboard visibility | already customer-set (LIVE) |

## Scale estimate

~**200–260 `app_content` keys** across ~28 screens + shared components, plus ~**5 new structured tables**
(`popular_search`, `scent_option`, `promo_banner`, and formalizing the existing home/collection
fallbacks). Recurring literals worth a shared namespace: "Sign in" (8×), "Browse fragrances" (3×),
placeholders "077 123 456" / "Aminata Kamara", brand strings "Borteh"/"Borteh Sprays".

## Keep-in-step warnings

- `NotifIcon.tsx` matches title keywords (`confirmed`/`on the way`/`arrived`/`cancelled`) tied to the
  DB trigger `fn_notify_order_status` copy — if those notification titles become editable, the glyph
  match logic must move to a stable field, not the title text.
- Order-status labels (`STATUS_LABEL`/`STATUS_TONE`) live in `lib/orders.ts`, not the screens.
