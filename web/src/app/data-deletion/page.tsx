import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";

// Public, unauthenticated page — Google Play requires this be reachable
// without the app installed and without signing in (Play's Account & Data
// Deletion policy). In-app deletion already exists and is the real,
// immediate path (mobile/lib/auth.ts fn_delete_account); this page exists
// for the person who no longer has the app, or can't sign in, and for
// reviewers checking the requirement is met. Same identity/typography
// treatment as /privacy — one real Instrument Serif face, bronze accent,
// no em dashes in the copy.

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Delete Your Account",
  description: "How to delete your Borteh Sprays account and data.",
};

const CONTACT_EMAIL = "borteh@borteh.app";
const CONTACT_WHATSAPP = "+232 79 70 11 93";

function StepCard({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-7">
      <span className="text-xs font-medium tracking-wide text-brand uppercase">{index}</span>
      <h2 className={`${serif.className} mt-1 text-2xl leading-none tracking-tight text-foreground`}>{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <span className="text-xs font-semibold tracking-[0.2em] text-brand uppercase">Borteh Sprays</span>
          <span className="text-xs text-muted-foreground">Freetown, Sierra Leone</span>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 pt-16 pb-24">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Account &amp; data</p>
        <h1 className={`${serif.className} mt-2 text-5xl leading-[1.05] tracking-tight text-foreground`}>Delete your account.</h1>

        <p className="mt-8 max-w-xl text-[1.0625rem] leading-relaxed text-foreground/90">
          You can delete your Borteh Sprays account and personal data at any time. There are two ways
          to do it, depending on whether you still have the app.
        </p>

        <div className="mt-12 space-y-6">
          <StepCard index="Option 1 · Recommended" title="Delete it in the app">
            <p>If you still have the app installed and can sign in, this is the fastest way, and it takes effect immediately.</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5">
              <li>Open the Borteh Sprays app and sign in.</li>
              <li>Go to your Profile, then Edit Profile.</li>
              <li>Scroll to &ldquo;Danger zone&rdquo; and tap Delete account.</li>
              <li>Confirm. Your account is deleted right away.</li>
            </ol>
          </StepCard>

          <StepCard index="Option 2" title="Request it another way">
            <p>
              If you no longer have the app, can&rsquo;t sign in, or would rather not use the in-app
              option, contact us directly and we&rsquo;ll delete your account for you. Please include
              the phone number your account is registered under, so we can verify it&rsquo;s you.
            </p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <a href={`mailto:${CONTACT_EMAIL}?subject=Delete my account`} className="text-foreground hover:text-brand">{CONTACT_EMAIL}</a>
              <span>WhatsApp: {CONTACT_WHATSAPP}</span>
            </div>
            <p className="mt-4">We process requests like this within 30 days.</p>
          </StepCard>
        </div>

        <section className="mt-14">
          <h2 className={`${serif.className} text-[1.75rem] leading-none tracking-tight text-foreground`}>What gets deleted</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We permanently remove your name, contact details, saved preferences, and everything else
            tied to your account. Order records may be retained without your name or other personal
            identifiers attached, for accounting and legal record-keeping purposes. This matches our{" "}
            <a href="/privacy" className="text-foreground underline decoration-border underline-offset-2 hover:text-brand hover:decoration-brand">
              Privacy Policy
            </a>
            , which explains what we collect and why in full.
          </p>
        </section>
      </article>
    </main>
  );
}
