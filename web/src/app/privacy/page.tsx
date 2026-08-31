import type { Metadata } from "next";

// Public, unauthenticated page — required for App Store / Play Store submission
// (Apple 5.1.1, Google Play Data Safety). Drafted from an actual audit of what
// this app collects (see mobile/lib for the real data model), not a generic
// template. Not written or reviewed by a lawyer — flagged clearly below and in
// the handoff to the owner; treat as a strong first draft, not a final legal
// document, especially given real payment processing is involved.

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Borteh Sprays collects, uses, and protects your information.",
};

const LAST_UPDATED = "31 August 2026";
const CONTACT_EMAIL = "borteh@borteh.app";
const CONTACT_WHATSAPP = "+232 79 70 11 93";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Legal</p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>

      <div className="mt-6 rounded-lg border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        This policy was drafted to plainly and accurately describe what the Borteh Sprays app actually
        collects and does. It has not been reviewed by a lawyer. If you have questions about how it
        applies to your situation, or before relying on it for a business decision, please seek
        independent legal advice.
      </div>

      <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
        Borteh Sprays (&ldquo;Borteh,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) operates the Borteh
        Sprays mobile app and this website, selling fragrances for delivery in Freetown, Sierra Leone.
        This policy explains what information we collect when you use the app, why we collect it, who
        we share it with, and the choices you have.
      </p>

      <Section title="Information we collect">
        <p>When you create an account and use the app, we collect:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-foreground">Account details</strong> — your name, phone number (used to sign in), and password. Your password is stored in encrypted (hashed) form; we cannot see it.</li>
          <li><strong className="text-foreground">Delivery information</strong> — the delivery address or landmark you provide, and the phone number we use to confirm delivery.</li>
          <li><strong className="text-foreground">Order history</strong> — items purchased, quantities, prices, order status, and (if applicable) why an order was cancelled.</li>
          <li><strong className="text-foreground">Payment information</strong> — which payment method you chose (mobile money or cash on delivery) and the status of that payment. We do not collect or store your mobile money PIN, card numbers, or other payment credentials — those are handled directly by our payment processor, Monime, not by Borteh.</li>
          <li><strong className="text-foreground">Loyalty &amp; rewards data</strong> — your points balance, lifetime spend, membership tier, and any referral codes you use or share.</li>
          <li><strong className="text-foreground">Preferences</strong> — fragrances you save, and answers to our scent quiz (preferred notes, gender category, budget, occasions), used to personalize what you see.</li>
          <li><strong className="text-foreground">Reviews</strong> — any review or rating you submit for a product.</li>
          <li><strong className="text-foreground">Notification token</strong> — a device identifier used to deliver push notifications, only if you enable them.</li>
          <li><strong className="text-foreground">Usage data</strong> — which products, collections, and features you view or tap, used to power recommendations like &ldquo;picked for you.&rdquo; This is first-party data we use ourselves; we do not share it with advertising networks or data brokers, and we do not use it for cross-app tracking.</li>
        </ul>
      </Section>

      <Section title="How we use your information">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>To create and manage your account, and process and deliver your orders.</li>
          <li>To run the loyalty and referral program, including calculating points and tier discounts.</li>
          <li>To personalize what you see in the app based on your browsing, purchases, and quiz answers.</li>
          <li>To send order updates (always on, since they&rsquo;re part of the service) and, only if you opt in, promotional offers.</li>
          <li>To respond when you contact us for support.</li>
          <li>To keep the app secure and prevent fraud or abuse.</li>
        </ul>
      </Section>

      <Section title="The leaderboard">
        <p>
          Borteh has an optional &ldquo;Top Buyers&rdquo; leaderboard that ranks customers by lifetime
          spend. By default, your name and spend amount may be visible to other customers on this
          leaderboard. You can turn this off at any time from the leaderboard screen — you&rsquo;ll
          still always be able to see your own rank, but other customers won&rsquo;t see your entry.
        </p>
      </Section>

      <Section title="Who we share information with">
        <p>We don&rsquo;t sell your personal information. We share it only where necessary to run the service:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-foreground">Supabase</strong> — our database, authentication, and file storage provider, which hosts the information described above.</li>
          <li><strong className="text-foreground">Monime</strong> — a licensed Sierra Leone payment processor, which handles mobile money payments. We share the order amount and a reference number, not your mobile money PIN.</li>
          <li><strong className="text-foreground">Expo</strong> — the push notification delivery service, if you have notifications enabled.</li>
          <li><strong className="text-foreground">WhatsApp (Meta)</strong> — if you choose to contact support over WhatsApp, that conversation is subject to WhatsApp&rsquo;s own privacy policy, not this one.</li>
        </ul>
        <p>We may also disclose information if required by law, or to protect the rights, safety, or property of Borteh, our customers, or the public.</p>
      </Section>

      <Section title="How long we keep your information">
        <p>
          We keep your account information for as long as your account is active. If you delete your
          account, we permanently remove your personal details. Order records may be retained without
          your name or other personal identifiers attached, for accounting and legal record-keeping
          purposes.
        </p>
      </Section>

      <Section title="Your choices">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Edit your name and account details at any time from your profile.</li>
          <li>Change your password at any time.</li>
          <li>Turn off promotional notifications while still receiving order updates.</li>
          <li>Hide yourself from the public leaderboard while still seeing your own rank.</li>
          <li>Delete your account and personal data at any time from within the app.</li>
          <li>Contact us to ask what information we hold about you, or to request a correction.</li>
        </ul>
      </Section>

      <Section title="Children">
        <p>
          Borteh is not directed at children, and we do not knowingly collect information from anyone
          under 13. If you believe a child has provided us with personal information, please contact us
          and we&rsquo;ll delete it.
        </p>
      </Section>

      <Section title="Security">
        <p>
          We use reasonable technical and organizational measures — including encrypted connections and
          access controls — to protect your information. No method of storage or transmission is
          completely secure, so we can&rsquo;t guarantee absolute security.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy from time to time. If we make material changes, we&rsquo;ll update
          the &ldquo;Last updated&rdquo; date above and, where appropriate, notify you in the app.
        </p>
      </Section>

      <Section title="Contact us">
        <p>Questions about this policy, or a request about your data:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Email: {CONTACT_EMAIL}</li>
          <li>WhatsApp: {CONTACT_WHATSAPP}</li>
        </ul>
      </Section>
    </main>
  );
}
