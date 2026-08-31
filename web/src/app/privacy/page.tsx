import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";

// Public, unauthenticated page — required for App Store / Play Store submission
// (Apple 5.1.1, Google Play Data Safety). Drafted from an actual audit of what
// this app collects (see mobile/lib for the real data model), not a generic
// template. Not written or reviewed by a lawyer — flagged clearly below and in
// the handoff to the owner; treat as a strong first draft, not a final legal
// document, especially given real payment processing is involved.
//
// Instrument Serif is Borteh's actual display face (mobile/lib/theme.ts) — the
// admin dashboard's own --font-display just maps to Inter, so this page loads
// its own serif locally rather than borrowing the dashboard's plain-text
// "legal doc dump" look. Structured like a real long-form document (a table
// of contents you can jump from, prose over bullet walls where the content
// is actually prose) rather than a flat stack of identical bulleted sections.

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Borteh Sprays collects, uses, and protects your information.",
};

const LAST_UPDATED = "31 August 2026";
const CONTACT_EMAIL = "borteh@borteh.app";
const CONTACT_WHATSAPP = "+232 79 70 11 93";

const SECTIONS = [
  { id: "collect", title: "Information we collect" },
  { id: "use", title: "How we use it" },
  { id: "leaderboard", title: "The leaderboard" },
  { id: "share", title: "Who we share it with" },
  { id: "retention", title: "How long we keep it" },
  { id: "choices", title: "Your choices" },
  { id: "children", title: "Children" },
  { id: "security", title: "Security" },
  { id: "changes", title: "Changes to this policy" },
  { id: "contact", title: "Contact us" },
];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className={`${serif.className} scroll-mt-24 text-[1.75rem] leading-none tracking-tight text-foreground`}>
      {children}
    </h2>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* identity bar — the one piece of real Borteh branding this page had none of */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <span className="text-xs font-semibold tracking-[0.2em] text-brand uppercase">Borteh Sprays</span>
          <span className="text-xs text-muted-foreground">Freetown, Sierra Leone</span>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 pt-16 pb-24">
        <p className={`${serif.className} text-sm text-muted-foreground italic`}>smell good today.</p>
        <h1 className={`${serif.className} mt-2 text-5xl leading-[1.05] tracking-tight text-foreground`}>Privacy Policy</h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>

        <p className="mt-8 max-w-xl text-[1.0625rem] leading-relaxed text-foreground/90">
          This describes what the Borteh Sprays app collects when you use it, why, who we share it
          with, and the choices you have. We&rsquo;ve written it in plain language, and it&rsquo;s
          accurate to what the app actually does, not a generic template.
        </p>

        <p className="mt-6 max-w-xl border-l-2 border-brand/40 pl-4 text-sm leading-relaxed text-muted-foreground italic">
          This policy was drafted to plainly and accurately describe our data practices. It has not
          been reviewed by a lawyer. If you have questions about how it applies to your situation, or
          before relying on it for a business decision, please seek independent legal advice.
        </p>

        {/* jump list — the thing a real long-form document gives you that a
            flat scroll of sections doesn't: a way to go straight to the one
            thing you're actually looking for */}
        <nav className="mt-12 rounded-[var(--radius-card)] border border-border bg-card px-5 py-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">On this page</p>
          <ol className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="group flex items-baseline gap-2 py-0.5 text-sm text-foreground/80 hover:text-brand">
                  <span className="tabular-nums text-muted-foreground group-hover:text-brand">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-14 space-y-14">
          <section>
            <H2 id="collect">Information we collect</H2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">When you create an account and use the app, we collect:</p>
            <ul className="mt-4 space-y-3 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
              <li><strong className="text-foreground">Account details.</strong> Your name, phone number (used to sign in), and password. Your password is stored in encrypted (hashed) form; we cannot see it.</li>
              <li><strong className="text-foreground">Delivery information.</strong> The delivery address or landmark you provide, and the phone number we use to confirm delivery.</li>
              <li><strong className="text-foreground">Order history.</strong> Items purchased, quantities, prices, order status, and (if applicable) why an order was cancelled.</li>
              <li><strong className="text-foreground">Payment information.</strong> Which payment method you chose (mobile money or cash on delivery) and the status of that payment. We do not collect or store your mobile money PIN, card numbers, or other payment credentials; those are handled directly by our payment processor, Monime, not by Borteh.</li>
              <li><strong className="text-foreground">Loyalty &amp; rewards data.</strong> Your points balance, lifetime spend, membership tier, and any referral codes you use or share.</li>
              <li><strong className="text-foreground">Preferences.</strong> Fragrances you save, and answers to our scent quiz (preferred notes, gender category, budget, occasions), used to personalize what you see.</li>
              <li><strong className="text-foreground">Reviews.</strong> Any review or rating you submit for a product.</li>
              <li><strong className="text-foreground">Notification token.</strong> A device identifier used to deliver push notifications, only if you enable them.</li>
              <li><strong className="text-foreground">Usage data.</strong> Which products, collections, and features you view or tap, used to power recommendations like &ldquo;picked for you.&rdquo; This is first-party data we use ourselves; we do not share it with advertising networks or data brokers, and we do not use it for cross-app tracking.</li>
            </ul>
          </section>

          <section>
            <H2 id="use">How we use it</H2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We use your information to create and run your account, process and deliver your orders,
              and operate the loyalty and referral program: calculating points, tier discounts,
              and rewards. We use your browsing history, purchases, and quiz answers to personalize what
              you see in the app. We send order updates, which are part of the service and always on,
              and promotional offers only if you&rsquo;ve opted in. And we use your information to
              respond when you contact us for support, and to keep the app secure and prevent fraud or
              abuse.
            </p>
          </section>

          <section>
            <H2 id="leaderboard">The leaderboard</H2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Borteh has an optional &ldquo;Top Buyers&rdquo; leaderboard that ranks customers by
              lifetime spend. By default, your name and spend amount may be visible to other customers
              on this leaderboard. You can turn this off at any time from the leaderboard screen.
              You&rsquo;ll still always be able to see your own rank, but other customers won&rsquo;t
              see your entry.
            </p>
          </section>

          <section>
            <H2 id="share">Who we share it with</H2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">We don&rsquo;t sell your personal information. We share it only where necessary to run the service:</p>
            <ul className="mt-4 space-y-3 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
              <li><strong className="text-foreground">Supabase.</strong> Our database, authentication, and file storage provider, which hosts the information described above.</li>
              <li><strong className="text-foreground">Monime.</strong> A licensed Sierra Leone payment processor, which handles mobile money payments. We share the order amount and a reference number, not your mobile money PIN.</li>
              <li><strong className="text-foreground">Expo.</strong> The push notification delivery service, if you have notifications enabled.</li>
              <li><strong className="text-foreground">WhatsApp (Meta).</strong> If you choose to contact support over WhatsApp, that conversation is subject to WhatsApp&rsquo;s own privacy policy, not this one.</li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              We may also disclose information if required by law, or to protect the rights, safety, or
              property of Borteh, our customers, or the public.
            </p>
          </section>

          <section>
            <H2 id="retention">How long we keep it</H2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We keep your account information for as long as your account is active. If you delete your
              account, we permanently remove your personal details. Order records may be retained
              without your name or other personal identifiers attached, for accounting and legal
              record-keeping purposes.
            </p>
          </section>

          <section>
            <H2 id="choices">Your choices</H2>
            <ul className="mt-4 space-y-3 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
              <li>Edit your name and account details at any time from your profile.</li>
              <li>Change your password at any time.</li>
              <li>Turn off promotional notifications while still receiving order updates.</li>
              <li>Hide yourself from the public leaderboard while still seeing your own rank.</li>
              <li>
                Delete your account and personal data at any time, from within the app or by{" "}
                <a href="/data-deletion" className="text-foreground underline decoration-border underline-offset-2 hover:text-brand hover:decoration-brand">
                  requesting it here
                </a>
                .
              </li>
              <li>Contact us to ask what information we hold about you, or to request a correction.</li>
            </ul>
          </section>

          <section>
            <H2 id="children">Children</H2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Borteh is not directed at children, and we do not knowingly collect information from
              anyone under 13. If you believe a child has provided us with personal information, please
              contact us and we&rsquo;ll delete it.
            </p>
          </section>

          <section>
            <H2 id="security">Security</H2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We use reasonable technical and organizational measures, including encrypted
              connections and access controls, to protect your information. No method of storage
              or transmission is completely secure, so we can&rsquo;t guarantee absolute security.
            </p>
          </section>

          <section>
            <H2 id="changes">Changes to this policy</H2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We may update this policy from time to time. If we make material changes, we&rsquo;ll
              update the &ldquo;Last updated&rdquo; date above and, where appropriate, notify you in the
              app.
            </p>
          </section>

          <section id="contact" className="scroll-mt-24 rounded-[var(--radius-card)] border border-border bg-card p-7 shadow-xl shadow-foreground/5">
            <h2 className={`${serif.className} text-2xl leading-none tracking-tight text-foreground`}>Contact us</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Questions about this policy, or a request about your data:
            </p>
            <div className="mt-5 flex flex-col gap-2 text-sm">
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-foreground hover:text-brand">{CONTACT_EMAIL}</a>
              <span className="text-muted-foreground">WhatsApp: {CONTACT_WHATSAPP}</span>
            </div>
          </section>
        </div>

        <p className="mt-16 text-xs text-muted-foreground">&copy; {new Date(LAST_UPDATED).getFullYear()} Borteh Sprays</p>
      </article>
    </main>
  );
}
