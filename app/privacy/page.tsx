import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Nemara',
  description:
    'How Nemara collects, uses, stores, and shares personal data, plus your rights as a user.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-ink">
      <nav className="mb-8 text-sm">
        <Link href="/login" className="text-terra underline">
          ← Back to Nemara
        </Link>
      </nav>

      <h1 className="font-serif text-4xl tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-ink3">
        Effective date: May 26, 2026
      </p>

      <section className="mt-8 rounded-lg border border-line bg-card-alt p-5">
        <h2 className="font-serif text-xl">Short version</h2>
        <p className="mt-2 text-sm text-ink2">
          Nemara helps families monitor an aging or vulnerable loved one
          through wall-mounted cameras paired to a caregiver phone or web
          dashboard. To do that, we collect the audio and video from those
          cameras, the events our AI detects from that footage (possible
          falls, wandering, agitation), your account info (email, name),
          and the device token we need to send you notifications. We use
          third-party services to host, stream, analyze, and notify. We do
          not sell your data. You can delete your account and everything
          tied to it at any time.
        </p>
      </section>

      <h2 className="mt-10 font-serif text-2xl">1. Who we are</h2>
      <p className="mt-3 text-ink2">
        Nemara is software for caregiver-driven monitoring. The service
        consists of an iOS application for caregivers, an iOS application
        for wall-mounted cameras (NemaraCam), and a companion web
        dashboard. This policy covers all three.
      </p>

      <h2 className="mt-10 font-serif text-2xl">2. Information we collect</h2>

      <h3 className="mt-5 font-serif text-lg">Account information</h3>
      <ul className="mt-2 list-disc pl-6 text-ink2 space-y-1">
        <li>Email address (used as your login).</li>
        <li>Display name (chosen by you).</li>
        <li>
          Phone number (optional, only if you choose to add one to your
          profile).
        </li>
        <li>Password (stored only as a hash by our auth provider).</li>
      </ul>

      <h3 className="mt-5 font-serif text-lg">Camera audio and video</h3>
      <p className="mt-2 text-ink2">
        Once you pair a wall-mounted camera, it continuously streams audio
        and video to our infrastructure for as long as the camera is in
        the &ldquo;connected&rdquo; state. Live frames flow through
        LiveKit Cloud and are processed in short clips (~15 seconds) by AI
        models to detect possible events. We retain a short clip and a
        text description for each event our system fires, plus a synthetic
        record of every analysis tick (whether or not an event was
        detected) for debugging and timeline display.
      </p>

      <h3 className="mt-5 font-serif text-lg">Configuration and events</h3>
      <ul className="mt-2 list-disc pl-6 text-ink2 space-y-1">
        <li>The patients, cameras, rooms, and detectors you configure.</li>
        <li>The events the AI detects, including type, time, and a short narrative.</li>
        <li>Caregiver reviews and notes you add to those events.</li>
      </ul>

      <h3 className="mt-5 font-serif text-lg">Device information</h3>
      <ul className="mt-2 list-disc pl-6 text-ink2 space-y-1">
        <li>Apple Push Notification (APNs) device token, so we can deliver lock-screen alerts.</li>
        <li>The iOS / device version your installed app is running.</li>
        <li>Authentication tokens for your active session.</li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">3. How we use this information</h2>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>Provide the service: stream video, run AI detection, deliver alerts, render the dashboard.</li>
        <li>Authenticate you and keep your sessions valid.</li>
        <li>Send you operational notifications (event alerts, password resets, account updates).</li>
        <li>Diagnose problems, improve detection accuracy, and prevent abuse.</li>
        <li>Comply with legal obligations when required.</li>
      </ul>
      <p className="mt-3 text-ink2">
        We do <strong>not</strong> use your audio, video, or detection
        data to train third-party AI models, sell it to advertisers, or
        share it with anyone for marketing.
      </p>

      <h2 className="mt-10 font-serif text-2xl">4. Third-party services we rely on</h2>
      <p className="mt-3 text-ink2">
        Nemara is built on infrastructure operated by other companies.
        Each receives only the data needed to do its job.
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>
          <strong>Supabase</strong> (PostgreSQL database, authentication,
          realtime, file storage) — stores your account, configuration, events, and event clips. Hosted in the US (AWS).
        </li>
        <li>
          <strong>LiveKit Cloud</strong> — relays the audio/video stream
          from each wall phone to the caregiver app and to our analysis backend.
        </li>
        <li>
          <strong>Railway</strong> — hosts our application backend (API
          and detection workers). US West.
        </li>
        <li>
          <strong>Vercel</strong> — hosts the web dashboard.
        </li>
        <li>
          <strong>Google (Gemini API)</strong> — analyzes camera clips for
          possible events. Frames are sent transiently; Google does not
          use them to train its models per its enterprise terms.
        </li>
        <li>
          <strong>OpenAI</strong> — used as a fallback analyzer when
          Gemini is unavailable. Same handling as Gemini.
        </li>
        <li>
          <strong>Apple (APNs)</strong> — delivers push notifications to
          your iPhone lock screen.
        </li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">5. Where data is stored</h2>
      <p className="mt-3 text-ink2">
        Your data is primarily stored in the United States. If you access
        Nemara from outside the US, your data is transferred to and
        processed in the US. By using Nemara you consent to that transfer.
      </p>

      <h2 className="mt-10 font-serif text-2xl">6. How long we keep data</h2>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>
          <strong>Live frames</strong> — held in memory only for the few seconds needed to run analysis. Not persisted.
        </li>
        <li>
          <strong>Event clips</strong> — stored for 30 days, then deleted automatically.
        </li>
        <li>
          <strong>Event records, analyses, and configuration</strong> — retained for as long as your account is active.
        </li>
        <li>
          <strong>Account data</strong> — deleted within 30 days of you closing your account.
        </li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">7. Your rights</h2>
      <p className="mt-3 text-ink2">
        You have the right to:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>Access the personal data we hold about you.</li>
        <li>Correct anything inaccurate.</li>
        <li>Delete your account and all associated data.</li>
        <li>Export your data in a portable format.</li>
        <li>Withdraw consent at any time by closing your account.</li>
      </ul>
      <p className="mt-3 text-ink2">
        To exercise any of these rights, email{' '}
        <a className="text-terra underline" href="mailto:sunnycui@stanford.edu">
          sunnycui@stanford.edu
        </a>{' '}
        from the address on file. We respond within 30 days.
      </p>

      <h2 className="mt-10 font-serif text-2xl">8. Consent of monitored people</h2>
      <p className="mt-3 text-ink2">
        Nemara is intended to be used by caregivers monitoring family
        members or others who <strong>have consented to being monitored</strong>.
        It is your responsibility as the caregiver to obtain that consent.
        Do not install a Nemara camera in any location where the people
        being recorded have not agreed to it.
      </p>

      <h2 className="mt-10 font-serif text-2xl">9. Children</h2>
      <p className="mt-3 text-ink2">
        Nemara is not directed to children under 13 and we do not
        knowingly collect personal data from anyone under 13. If you
        believe a child under 13 has provided us data, email us and we
        will delete it.
      </p>

      <h2 className="mt-10 font-serif text-2xl">10. Security</h2>
      <p className="mt-3 text-ink2">
        All connections between the apps and our infrastructure use
        TLS/HTTPS. Authentication tokens are stored in the iOS Keychain.
        Video streams are encrypted in transit by LiveKit. Database access
        is gated by row-level security policies tied to your account.
      </p>
      <p className="mt-3 text-ink2">
        No system is perfectly secure. If you discover a security issue,
        please report it to{' '}
        <a className="text-terra underline" href="mailto:sunnycui@stanford.edu">
          sunnycui@stanford.edu
        </a>{' '}
        before disclosing it publicly.
      </p>

      <h2 className="mt-10 font-serif text-2xl">11. Changes to this policy</h2>
      <p className="mt-3 text-ink2">
        We may update this policy. If we make material changes we will
        notify active users via the app or by email. Continued use of
        Nemara after a change means you accept the updated policy.
      </p>

      <h2 className="mt-10 font-serif text-2xl">12. Contact</h2>
      <p className="mt-3 text-ink2">
        Questions, requests, or complaints:{' '}
        <a className="text-terra underline" href="mailto:sunnycui@stanford.edu">
          sunnycui@stanford.edu
        </a>
        .
      </p>

      <p className="mt-12 text-sm text-ink3">
        See also our{' '}
        <Link href="/terms" className="text-terra underline">
          Terms of Service
        </Link>
        .
      </p>
    </main>
  );
}
