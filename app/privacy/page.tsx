import Link from 'next/link';

export const metadata = {
  title: 'Privacy Notice — Nemara',
  description:
    'How Nemara handles in-home sensor data, what we do and do not store, and your rights.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-ink">
      <nav className="mb-8 text-sm">
        <Link href="/login" className="text-terra underline">
          ← Back to Nemara
        </Link>
      </nav>

      <h1 className="font-serif text-4xl tracking-tight">Privacy Notice</h1>
      <p className="mt-2 text-sm text-ink3">
        In-home monitoring · Effective May 26, 2026
      </p>

      <section className="mt-8 rounded-lg border border-line bg-card-alt p-5">
        <h2 className="font-serif text-xl">The short version</h2>
        <p className="mt-2 text-sm text-ink2">
          The Nemara sensor streams live video and audio while it is
          active so a household-activity AI can flag possible events
          and so authorized family members can look in through the app.
          <strong> We do not record or store any of that video or audio.</strong>{' '}
          Streams pass through processing and are immediately discarded.
          What we keep are short text descriptions of activity, your
          account details, and configuration — nothing visual or audible
          is retained. We never sell your data and we do not allow our
          AI provider to retain or train on it.
        </p>
      </section>

      <h2 className="mt-10 font-serif text-2xl">What the sensor captures</h2>
      <p className="mt-3 text-ink2">
        Each Nemara sensor is an iPhone mounted in a household room you
        choose. While the sensor is active, it captures live video and
        audio from that room and streams it in real time to our service.
        Sensors can be paused or fully disconnected at any time from the
        app or web dashboard; when paused or disconnected, no video or
        audio leaves the room.
      </p>

      <h2 className="mt-10 font-serif text-2xl">How we handle video and audio</h2>
      <p className="mt-3 text-ink2">
        We do not record or store any of the video or audio captured by
        the sensor. When the sensor is active, the live stream is sent
        in real time to:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>
          A third-party AI service that analyzes the stream in real time
          to surface insights about household activity (for example: a
          possible fall, a person leaving the room, sustained restless
          motion).
        </li>
        <li>
          Authorized users — typically family caregivers — who choose to
          &ldquo;look in&rdquo; live through our app or web dashboard.
        </li>
      </ul>
      <p className="mt-3 text-ink2">
        Once a stream has passed through processing the live video and
        audio is discarded. When the AI flags a possible event, a short
        clip covering that event is briefly retained for processing and
        then automatically deleted. We do not maintain a library of
        stored video or audio for later replay.
      </p>

      <h2 className="mt-10 font-serif text-2xl">What we do store</h2>
      <p className="mt-3 text-ink2">
        We store small amounts of information that are necessary for
        the product to function:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>
          <strong>Activity records</strong> — timestamps and short text
          descriptions of observed activity. Example: &ldquo;possible
          fall in the kitchen at 2:14 pm.&rdquo;
        </li>
        <li>
          <strong>Aggregated patterns</strong> — derived signals over
          time such as hours awake, room transitions, or motion
          frequency. Used to power the dashboard.
        </li>
        <li>
          <strong>Account and device information</strong> — account
          holder name, contact details, room labels, device
          configuration, and push notification tokens.
        </li>
        <li>
          <strong>Authentication logs</strong> — when authorized users
          signed in or opened a live look-in session.
        </li>
      </ul>
      <p className="mt-3 text-ink2">
        We do not maintain a library of stored clips or media content
        for later replay.
      </p>

      <h2 className="mt-10 font-serif text-2xl">Where data is processed</h2>
      <p className="mt-3 text-ink2">
        Streams and stored data are processed in the United States by
        the following service providers, each receiving only the data
        needed to do its job:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>
          <strong>LiveKit Cloud</strong> — the real-time relay that
          carries the live stream from the sensor to the AI service and
          to authorized look-in viewers. LiveKit does not retain
          stream contents.
        </li>
        <li>
          <strong>Google AI (Gemini)</strong> — the AI service that
          analyzes the live stream. Operates from US data centers.
        </li>
        <li>
          <strong>OpenAI</strong> — a secondary AI service used as a
          fallback when Gemini is unavailable. Same handling.
        </li>
        <li>
          <strong>Supabase</strong> — stores activity records, account
          info, and configuration. Hosted in the United States on AWS.
        </li>
        <li>
          <strong>Railway</strong> — hosts our application backend.
        </li>
        <li>
          <strong>Vercel</strong> — hosts the web dashboard.
        </li>
        <li>
          <strong>Apple (APNs)</strong> — delivers push notifications
          to your iPhone.
        </li>
      </ul>
      <p className="mt-3 text-ink2">
        Our agreements with the AI providers require that they:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>Not retain any video or audio after processing.</li>
        <li>Not use any of your data to train their AI models.</li>
        <li>Protect data in transit with industry-standard security.</li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">Live look-in</h2>
      <p className="mt-3 text-ink2">
        Authorized users can open the app and watch and listen to the
        live stream at any time. Look-in sessions are not recorded.
      </p>

      <h2 className="mt-10 font-serif text-2xl">Who can access the stream</h2>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>You — the account holder.</li>
        <li>
          Anyone you authorize in the app — for example, other family
          members or designated caregivers.
        </li>
      </ul>
      <p className="mt-3 text-ink2">
        Nemara staff, including the founders, cannot view the live
        stream. The AI service automatically processes the stream;
        their staff do not view it either.
      </p>

      <h2 className="mt-10 font-serif text-2xl">How we protect your data</h2>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>All streams and stored data are encrypted in transit (TLS) and at rest.</li>
        <li>Access requires authentication; database rows are gated by row-level security tied to your account.</li>
        <li>Authentication tokens on iOS are stored in the device Keychain.</li>
        <li>
          We will notify you of any security incident that creates a
          real risk of significant harm.
        </li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">Your rights</h2>
      <p className="mt-3 text-ink2">You have the right to:</p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>Know what information we hold about you and your household.</li>
        <li>Correct any inaccurate information.</li>
        <li>Withdraw consent and have your sensors deactivated.</li>
        <li>Request deletion of stored activity records and other data.</li>
        <li>Export your data in a portable format.</li>
      </ul>
      <p className="mt-3 text-ink2">
        Depending on where you live you may have additional rights
        under your local privacy law (such as GDPR in Europe, CCPA in
        California, or PIPEDA in Canada). To exercise any right, email
        the privacy contact below. We respond within 30 days.
      </p>

      <h2 className="mt-10 font-serif text-2xl">Limitations on use</h2>
      <p className="mt-3 text-ink2">We will not:</p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>Maintain a video or audio archive accessible for later replay.</li>
        <li>Sell your data to anyone.</li>
        <li>Use stored information for advertising.</li>
        <li>
          Share with insurance companies, employers, or government
          agencies, except as required by law.
        </li>
        <li>Allow the AI provider to retain or train on your data.</li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">Consent of monitored people</h2>
      <p className="mt-3 text-ink2">
        Nemara is intended to be used by caregivers monitoring family
        members or others who <strong>have consented to being monitored</strong>.
        It is your responsibility as the caregiver to obtain that
        consent. Do not install a Nemara sensor in any location where
        the people present have not agreed to it. Inform visitors and
        third parties who enter the room that sensors are in use.
      </p>

      <h2 className="mt-10 font-serif text-2xl">Children</h2>
      <p className="mt-3 text-ink2">
        Nemara is not directed to children under 13 and we do not
        knowingly collect personal data from anyone under 13. If you
        believe a child under 13 has provided us data, email us and we
        will delete it.
      </p>

      <h2 className="mt-10 font-serif text-2xl">About the service</h2>
      <p className="mt-3 text-ink2">
        Nemara is a general wellness service intended to provide
        household activity insights for informational and convenience
        purposes. Nemara is{' '}
        <strong>not a medical device</strong> and is not intended to
        diagnose, treat, cure, prevent, or monitor any disease, medical
        condition, or symptom. The service is not a substitute for
        professional medical care, supervision, or emergency response.
        See our{' '}
        <Link href="/terms" className="text-terra underline">
          Terms of Service
        </Link>{' '}
        for the scope and limitations of the service.
      </p>

      <h2 className="mt-10 font-serif text-2xl">Changes to this notice</h2>
      <p className="mt-3 text-ink2">
        We may update this notice. If we make material changes we will
        notify active users via the app or by email. Continued use of
        Nemara after a change means you accept the updated notice.
      </p>

      <h2 className="mt-10 font-serif text-2xl">Contact</h2>
      <p className="mt-3 text-ink2">
        Privacy questions, requests, or complaints:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>Sunny Cui</li>
        <li>
          <a className="text-terra underline" href="mailto:sunnycui@stanford.edu">
            sunnycui@stanford.edu
          </a>
        </li>
        <li>
          <a className="text-terra underline" href="tel:+17166021101">
            716-602-1101
          </a>
        </li>
      </ul>

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
