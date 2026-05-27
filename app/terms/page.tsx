import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Nemara',
  description:
    'The terms you agree to when using Nemara, including critical safety disclaimers.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-ink">
      <nav className="mb-8 text-sm">
        <Link href="/login" className="text-terra underline">
          ← Back to Nemara
        </Link>
      </nav>

      <h1 className="font-serif text-4xl tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-ink3">
        Effective date: May 26, 2026
      </p>

      <section className="mt-8 rounded-lg border border-terra/40 bg-terra-soft p-5">
        <h2 className="font-serif text-xl text-terra-deep">Important — read this first</h2>
        <p className="mt-2 text-sm text-terra-deep">
          Nemara is a monitoring aid for families. It is{' '}
          <strong>not a medical device</strong>, not a replacement for
          professional supervision, and not connected to emergency
          services. The AI can miss real events or flag things that did
          not happen. Do not rely on Nemara alone for the safety of
          anyone whose well-being depends on prompt human intervention.
        </p>
      </section>

      <h2 className="mt-10 font-serif text-2xl">1. What Nemara is</h2>
      <p className="mt-3 text-ink2">
        Nemara is a software service that streams audio and video from
        wall-mounted iPhones running our NemaraCam app, runs AI analysis
        on those streams to flag possible events (such as a possible fall,
        wandering, or agitation), and surfaces those flags to a caregiver
        through our iOS app and web dashboard. The service includes the
        Nemara caregiver iOS app, the NemaraCam iOS app, and the web
        dashboard at nemara-caregiver-web.vercel.app and any related
        future domain.
      </p>

      <h2 className="mt-10 font-serif text-2xl">2. Eligibility and consent</h2>
      <p className="mt-3 text-ink2">
        You must be at least 18 years old to create a Nemara account.
        By using the service you represent that:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>
          You have the legal authority to install monitoring cameras in
          the location where you place them.
        </li>
        <li>
          Every person who will be visible or audible to a Nemara camera
          has consented to being monitored, or you are their legal
          guardian and consent on their behalf in accordance with
          applicable law.
        </li>
        <li>
          You will inform any visitor or third party who enters the
          monitored space that cameras are in use.
        </li>
      </ul>
      <p className="mt-3 text-ink2">
        Recording people without their consent may be illegal in your
        jurisdiction. You are responsible for compliance.
      </p>

      <h2 className="mt-10 font-serif text-2xl">3. Not a medical device</h2>
      <p className="mt-3 text-ink2">
        Nemara is a consumer monitoring tool, not a medical device. It
        has not been evaluated or approved by the FDA or any other
        regulatory authority. Its AI detection (including possible falls,
        possible wandering, possible agitation, and possible medication
        events) is informational only. Words like &ldquo;possible&rdquo;
        in event titles and notifications are deliberate: the AI can be
        wrong in either direction.
      </p>
      <p className="mt-3 text-ink2">
        Do not use Nemara to diagnose, treat, or manage any medical
        condition. Do not use it as the sole means of supervision for
        anyone who would be in danger without prompt human response.
        Nemara does not contact emergency services, medical professionals,
        or any third party on your behalf.
      </p>

      <h2 className="mt-10 font-serif text-2xl">4. Your account</h2>
      <p className="mt-3 text-ink2">
        You are responsible for keeping your password secure and for all
        activity that happens under your account. Notify us if you
        suspect unauthorized access.
      </p>

      <h2 className="mt-10 font-serif text-2xl">5. Acceptable use</h2>
      <p className="mt-3 text-ink2">You agree not to:</p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>Record any person who has not consented to being monitored.</li>
        <li>Use Nemara to harass, stalk, surveil without consent, or otherwise harm any person.</li>
        <li>Resell access to Nemara or use it to provide a commercial monitoring service without a separate written agreement.</li>
        <li>Attempt to reverse-engineer, scrape, or otherwise extract data from the service in ways not exposed by the apps.</li>
        <li>Use the service to violate any law, regulation, or court order.</li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">6. Hardware and third-party services</h2>
      <p className="mt-3 text-ink2">
        Nemara runs on iPhones running iOS. You supply the hardware. The
        service depends on third-party providers (Supabase, LiveKit
        Cloud, Railway, Vercel, Google, OpenAI, Apple) whose own terms
        apply to portions of the service they operate. We do not control
        their availability or their terms. Outages or changes by those
        providers may affect Nemara.
      </p>

      <h2 className="mt-10 font-serif text-2xl">7. Detection limitations</h2>
      <p className="mt-3 text-ink2">
        AI detection is probabilistic. The system will sometimes:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>Flag events that did not happen (false positives).</li>
        <li>Miss events that did happen (false negatives).</li>
        <li>Misclassify the type or severity of an event.</li>
        <li>Be unable to process clips during network or service outages.</li>
      </ul>
      <p className="mt-3 text-ink2">
        Push notifications may be delayed by Apple&apos;s APNs network,
        the recipient&apos;s phone settings, cellular conditions, or do-not-disturb
        modes. Do not assume an alert will reach you within any specific
        window.
      </p>

      <h2 className="mt-10 font-serif text-2xl">8. Service availability</h2>
      <p className="mt-3 text-ink2">
        Nemara is provided on an &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo; basis. We do not guarantee any uptime, response
        time, or detection accuracy. We may modify, suspend, or
        discontinue all or part of the service at any time.
      </p>

      <h2 className="mt-10 font-serif text-2xl">9. Disclaimers</h2>
      <p className="mt-3 text-ink2 uppercase">
        TO THE FULLEST EXTENT PERMITTED BY LAW, NEMARA IS PROVIDED
        WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
        BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS
        FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
      </p>

      <h2 className="mt-10 font-serif text-2xl">10. Limitation of liability</h2>
      <p className="mt-3 text-ink2 uppercase">
        TO THE FULLEST EXTENT PERMITTED BY LAW, NEMARA AND ITS OPERATORS
        WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
        REVENUE, DATA, OR GOODWILL, ARISING FROM YOUR USE OF OR INABILITY
        TO USE THE SERVICE, INCLUDING ANY MISSED, DELAYED, OR INACCURATE
        DETECTION OF AN EVENT.
      </p>
      <p className="mt-3 text-ink2">
        Our total liability for any claim related to the service will
        not exceed the greater of (a) the amount you paid us for the
        service in the 12 months preceding the claim, or (b) USD $50.
      </p>

      <h2 className="mt-10 font-serif text-2xl">11. Termination</h2>
      <p className="mt-3 text-ink2">
        You may stop using Nemara and delete your account at any time.
        We may suspend or terminate your access if you violate these
        terms or if we reasonably believe you are using the service
        unsafely. Sections of these terms intended to survive termination
        (disclaimers, limitation of liability, governing law) survive.
      </p>

      <h2 className="mt-10 font-serif text-2xl">12. Changes to these terms</h2>
      <p className="mt-3 text-ink2">
        We may update these terms. Continued use of Nemara after we
        update them constitutes acceptance of the new terms. If we make
        material changes we will notify active users via the app or by
        email.
      </p>

      <h2 className="mt-10 font-serif text-2xl">13. Governing law</h2>
      <p className="mt-3 text-ink2">
        These terms are governed by the laws of the State of California
        and the federal laws of the United States, without regard to
        conflict-of-laws principles. Any dispute will be resolved
        exclusively in the state or federal courts located in San
        Francisco County, California.
      </p>

      <h2 className="mt-10 font-serif text-2xl">14. Contact</h2>
      <p className="mt-3 text-ink2">
        Questions about these terms:{' '}
        <a className="text-terra underline" href="mailto:sunnycui@stanford.edu">
          sunnycui@stanford.edu
        </a>
        .
      </p>

      <p className="mt-12 text-sm text-ink3">
        See also our{' '}
        <Link href="/privacy" className="text-terra underline">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
