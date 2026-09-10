# App Store / Play submission notes

Everything App Review needs, and the reasoning behind the answers, so the next
submission doesn't have to rediscover it.

**Credentials never live in this repo.** The demo account's password goes in App
Store Connect → App Review Information, and nowhere else.

---

## 1. Create the demo reviewer account

Apple rejects builds when the reviewer can't sign in (Guideline 2.1), and this
app's login is a Sierra Leone phone number — which a reviewer in California
cannot receive. Give them a working account.

There is no SMS step (ADR-004: phone + password, no OTP), so the account is made
through the app itself. No SQL, no dashboard:

1. Install the build (TestFlight or a dev build) and open **Sign up**.
2. Phone: `077 000 000` — normalises to `+23277000000`, a number that isn't a
   real Orange SL subscriber line.
3. Name: `App Review`.
4. Password: generate a strong one and **paste it straight into App Store
   Connect → App Review Information**. Don't put it in Slack, this repo, or a
   commit message.
5. Sign in once to confirm it works, then leave the account signed out.

Leave the account's order history empty. Seeding fake orders would land in the
owner's real revenue figures — the Dashboard and Analytics count every order —
and a reviewer doesn't need order history to assess the app. If they place a
test order it appears in the live queue like any other; cancel it afterwards.

Browsing, search, product pages and the cart all work signed out; only checkout,
reviews, wishlist and the account screens need the login. Say so in the notes
below so the reviewer doesn't assume the app is gated.

---

## 2. Paste into App Review Information → Notes

> Borteh Sprays is a retail app for a perfume shop in Freetown, Sierra Leone.
> Customers browse fragrances, place an order, and either pay cash on delivery or
> by local mobile money (Orange Money / Afrimoney) through our payment provider,
> Monime. Everything sold is a physical product shipped to the customer, so no
> in-app purchase is involved.
>
> Browsing works without an account. A demo account is provided for checkout,
> reviews and account features.
>
> User-generated content: customers can leave a written review on a product they
> can see. Reviews pass an automatic word filter before publishing — anything it
> catches is held for staff approval instead of going live. Every review by
> another customer carries a menu offering "Report review" and "Block this
> customer": reporting hides the review immediately and queues it for staff, and
> blocking hides that customer's reviews from the person who blocked them. Staff
> review reports through our admin within 24 hours. Support contact is published
> in the app (Profile → WhatsApp support) and in the privacy policy.
>
> Account deletion: Profile → Edit profile → Delete account. It deletes the
> account immediately. Where the customer has past orders, personal details are
> erased and the order record is kept anonymised for accounting, and the login is
> disabled permanently — this is described in the privacy policy.
>
> Push notifications are optional and only requested when the customer turns them
> on; the app never prompts on launch.

---

## 3. Store listing URLs

Both must load for a signed-out stranger. They sit on the admin site but are
deliberately outside its auth gate (`web/src/proxy.ts` `PUBLIC_PATHS`, pinned by
`web/src/proxy.test.ts` — they were previously redirecting to `/login`, which
would have failed review):

- Privacy policy: `https://borteh-sprays-admin.vercel.app/privacy`
- Account/data deletion (required by Google Play): `https://borteh-sprays-admin.vercel.app/data-deletion`

Check both in a private window before every submission.

---

## 4. Pre-submission checklist

- [ ] Both URLs above load signed out, in a private window.
- [ ] Demo account signs in on the exact build being submitted.
- [ ] Demo credentials are in App Review Information and are current.
- [ ] App Privacy answers declare what we actually collect: name, phone, order
      history, and in-app usage/analytics events. The analytics are first-party
      only (`mobile/lib/track.ts` → our own Supabase), never shared with third
      parties and never used to track across other companies' apps, so App
      Tracking Transparency does not apply — but "Usage Data" must still be
      declared.
- [ ] Age rating reflects that the app carries user-generated reviews.
- [ ] Screenshots uploaded at the sizes App Store Connect requires.
- [ ] Support URL and marketing URL set.
- [ ] `eas submit` picks up `ascAppId` `6792957816` from `mobile/eas.json`.

## 5. Known answers to likely reviewer questions

**"How do you moderate user-generated content?"** — See the notes above; the
mechanism is `supabase/migrations/20260910160635_review_moderation_report_block.sql`.
Clients cannot publish a review directly: writes go through `fn_submit_review`,
which decides the status, and the word list in `moderation_term` is editable by
staff without a deploy.

**"Why do you need a phone number?"** — It's the login identifier and the
delivery contact; there is no email in the country's normal usage pattern. It's
stated at signup with the privacy policy linked beside it.

**"Is the loyalty scheme a purchasable currency?"** — No. Points are earned on
delivered orders and referrals, and redeemed as a discount at checkout. They
cannot be bought, so Guideline 3.1.1 does not apply.
