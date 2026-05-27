import Link from 'next/link';

export const metadata = {
  title: 'Wellness Terms of Use — Nemara',
  description:
    'The terms you agree to when using Nemara, including critical safety, liability, and use disclaimers.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-ink">
      <nav className="mb-8 text-sm">
        <Link href="/login" className="text-terra underline">
          ← Back to Nemara
        </Link>
      </nav>

      <h1 className="font-serif text-4xl tracking-tight">
        Nemara Wellness Terms of Use
      </h1>
      <p className="mt-2 text-sm text-ink3">
        Last updated: May 26, 2026
      </p>

      <p className="mt-6 text-ink2">
        These Wellness Terms of Use (&ldquo;Terms&rdquo;) govern your
        use of the Nemara service and any related devices, software,
        and applications (collectively, the &ldquo;Service&rdquo;). By
        using the Service, you agree to these Terms. If you do not
        agree, do not use the Service.
      </p>

      <section className="mt-8 rounded-lg border border-terra/40 bg-terra-soft p-5">
        <h2 className="font-serif text-xl text-terra-deep">
          Important — please read carefully
        </h2>
        <p className="mt-2 text-sm text-terra-deep">
          These Terms contain important limitations on our liability
          and describe what the Service is and is not intended to do.
        </p>
      </section>

      <h2 className="mt-10 font-serif text-2xl">1. Acceptance of these Terms</h2>
      <p className="mt-3 text-ink2">
        You accept these Terms by (a) signing the Consent to In-Home
        Monitoring form, (b) clicking or tapping to accept these Terms
        in the Nemara application, or (c) using the Service in any
        other manner. Your continued use of the Service constitutes
        acceptance of any updates to these Terms.
      </p>

      <h2 className="mt-10 font-serif text-2xl">
        2. The Service is a Wellness Service, not a Medical Device
      </h2>
      <p className="mt-3 text-ink2">
        Nemara is a general wellness service intended to provide
        insights about household activity and routines for
        informational and convenience purposes only.
      </p>
      <p className="mt-3 text-ink2">
        Nemara is <strong>not a medical device</strong>. The Service
        is not intended to diagnose, treat, cure, prevent, or monitor
        any disease, medical condition, or symptom. The Service is not
        intended to be used as a substitute for any medical or
        clinical decision, advice, examination, or treatment by a
        qualified healthcare professional.
      </p>
      <p className="mt-3 text-ink2">
        The Service is not a substitute for in-person caregiving,
        supervision, or professional medical care of any kind.
      </p>

      <h2 className="mt-10 font-serif text-2xl">
        3. Not an Emergency Response System
      </h2>
      <p className="mt-3 text-ink2">
        The Service is not designed or intended to detect, identify,
        or respond to emergencies of any kind, including but not
        limited to falls, medical events, fires, intrusions, or other
        urgent situations.
      </p>
      <p className="mt-3 text-ink2">
        In case of emergency, you must contact local emergency
        services directly (such as 911 in the United States or
        Canada). Do not rely on the Service to alert you, anyone in
        your household, or anyone else to emergencies.
      </p>
      <p className="mt-3 text-ink2">
        You acknowledge that the Service may fail to surface, may
        delay, or may inaccurately characterize events of any kind,
        and that you bear sole responsibility for emergency
        preparedness, response, and the safety of household members.
      </p>

      <h2 className="mt-10 font-serif text-2xl">
        4. No Guarantees of Detection or Accuracy
      </h2>
      <p className="mt-3 text-ink2">
        Any insights, observations, summaries, alerts, or notifications
        surfaced by the Service are informational only and are provided
        on a best-effort basis. Nemara makes no representations or
        warranties regarding:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>The accuracy, completeness, reliability, or timeliness of any output of the Service.</li>
        <li>Whether the Service will surface or fail to surface any particular activity or event.</li>
        <li>Whether the Service will operate without interruption or error.</li>
        <li>The continued availability of any feature, capability, or third-party integration.</li>
      </ul>
      <p className="mt-3 text-ink2">
        You acknowledge that the Service may produce false positives,
        false negatives, missed signals, inaccurate descriptions, and
        delays, and you agree not to rely on the Service for any
        purpose that requires assurance of detection, accuracy, or
        completeness.
      </p>

      <h2 className="mt-10 font-serif text-2xl">
        5. AS-IS Service; Disclaimer of Warranties
      </h2>
      <p className="mt-3 text-ink2 uppercase">
        THE SERVICE IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS
        AVAILABLE&rdquo; BASIS, WITHOUT WARRANTIES OF ANY KIND,
        WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. TO THE
        FULLEST EXTENT PERMITTED BY APPLICABLE LAW, NEMARA AND ITS
        AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND
        SUPPLIERS DISCLAIM ALL WARRANTIES, INCLUDING WITHOUT
        LIMITATION THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS
        FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT, AND ANY
        WARRANTIES ARISING FROM COURSE OF DEALING, COURSE OF
        PERFORMANCE, OR USAGE OF TRADE.
      </p>
      <p className="mt-3 text-ink2 uppercase">
        NEMARA DOES NOT WARRANT THAT THE SERVICE WILL MEET YOUR
        REQUIREMENTS, OPERATE WITHOUT INTERRUPTION, BE ERROR-FREE, OR
        BE SECURE FROM UNAUTHORIZED ACCESS.
      </p>

      <h2 className="mt-10 font-serif text-2xl">6. Limitation of Liability</h2>
      <p className="mt-3 text-ink2 uppercase">
        TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT
        WILL NEMARA, ITS AFFILIATES, OR THEIR RESPECTIVE OFFICERS,
        DIRECTORS, EMPLOYEES, AGENTS, OR SUPPLIERS BE LIABLE FOR ANY
        INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR
        PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR
        LOSS OF PROFITS, REVENUE, GOODWILL, DATA, OR OTHER INTANGIBLE
        LOSSES, ARISING OUT OF OR RELATING TO THESE TERMS OR YOUR USE
        OF (OR INABILITY TO USE) THE SERVICE, EVEN IF NEMARA HAS BEEN
        ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p className="mt-3 text-ink2 uppercase">
        IN NO EVENT WILL NEMARA&rsquo;S AGGREGATE LIABILITY ARISING
        OUT OF OR RELATING TO THESE TERMS OR THE SERVICE EXCEED THE
        GREATER OF (A) THE TOTAL AMOUNT YOU PAID TO NEMARA FOR THE
        SERVICE IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING
        RISE TO THE CLAIM, OR (B) ONE HUNDRED CANADIAN DOLLARS
        (CAD $100).
      </p>
      <p className="mt-3 text-ink2">
        Some jurisdictions do not allow the exclusion or limitation of
        certain damages, so some of the above limitations may not
        apply to you. In such jurisdictions, our liability is limited
        to the maximum extent permitted by law.
      </p>

      <h2 className="mt-10 font-serif text-2xl">7. Indemnification</h2>
      <p className="mt-3 text-ink2">
        You agree to defend, indemnify, and hold harmless Nemara, its
        affiliates, and their respective officers, directors,
        employees, and agents from and against any and all claims,
        damages, losses, costs, and expenses (including reasonable
        attorneys&rsquo; fees) arising out of or relating to:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>Your use or misuse of the Service.</li>
        <li>Your violation of these Terms or any applicable law.</li>
        <li>
          Any claim by a third party (including a household member or
          visitor) arising from the operation of the Service in your
          home, including claims related to recording, audio capture,
          privacy, or consent.
        </li>
        <li>Your reliance on the Service for any purpose for which it is not intended.</li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">8. Your Responsibilities</h2>
      <p className="mt-3 text-ink2">You agree that you are solely responsible for:</p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>
          <strong>Lawful use.</strong> Using the Service in compliance
          with all applicable laws in your jurisdiction, including
          laws governing audio recording, video surveillance, and
          privacy.
        </li>
        <li>
          <strong>Notice to others.</strong> Informing all household
          members and visitors that the Service may capture audio and
          video.
        </li>
        <li>
          <strong>Placement.</strong> Placing the device only in
          appropriate locations, and not in bathrooms, bedrooms used
          by non-consenting individuals, or any other area where a
          person has a reasonable expectation of privacy.
        </li>
        <li>
          <strong>Authorization.</strong> Managing who is authorized
          to access the live stream through the app.
        </li>
        <li>
          <strong>Emergency response.</strong> Maintaining your own
          arrangements for emergency response and not relying on the
          Service for that purpose.
        </li>
        <li>
          <strong>Network and power.</strong> Maintaining the internet
          connection and power supply necessary for the Service to
          operate; the Service may be unavailable when these are
          disrupted.
        </li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">9. Changes to the Service</h2>
      <p className="mt-3 text-ink2">
        Nemara may modify, suspend, or discontinue any part of the
        Service at any time, including specific features,
        integrations, or supported devices, with or without notice.
        Nemara is not liable to you or any third party for any
        modification, suspension, or discontinuation of the Service.
      </p>

      <h2 className="mt-10 font-serif text-2xl">10. Changes to These Terms</h2>
      <p className="mt-3 text-ink2">
        Nemara may update these Terms from time to time. We will
        notify you of material changes through the Service or by
        other reasonable means. Your continued use of the Service
        after the effective date of any update constitutes acceptance
        of the updated Terms.
      </p>

      <h2 className="mt-10 font-serif text-2xl">
        11. Dispute Resolution and Arbitration
      </h2>
      <p className="mt-3 text-ink2">
        Any dispute, claim, or controversy arising out of or relating
        to these Terms or the Service will be resolved by binding
        arbitration administered under the rules of a recognized
        arbitration body in your jurisdiction, rather than in court,
        except that you may assert claims in small claims court if
        the claims qualify.
      </p>
      <p className="mt-3 text-ink2">
        Where binding arbitration or class-action waivers are not
        permitted under applicable law, those provisions will not
        apply, but the remainder of these Terms will continue to
        apply.
      </p>

      <h2 className="mt-10 font-serif text-2xl">12. Governing Law</h2>
      <p className="mt-3 text-ink2">
        These Terms are governed by the laws of the State of
        California, United States, without regard to its conflict of
        laws principles. The parties agree to the exclusive
        jurisdiction of the courts located in Santa Clara County,
        California for any matters not subject to arbitration.
      </p>

      <h2 className="mt-10 font-serif text-2xl">13. Severability</h2>
      <p className="mt-3 text-ink2">
        If any provision of these Terms is held to be invalid or
        unenforceable, that provision will be limited or eliminated
        to the minimum extent necessary so that the remaining
        provisions will continue in full force and effect.
      </p>

      <h2 className="mt-10 font-serif text-2xl">14. Entire Agreement</h2>
      <p className="mt-3 text-ink2">
        These Terms, together with the{' '}
        <Link href="/privacy" className="text-terra underline">
          Privacy Notice
        </Link>{' '}
        and the Consent to In-Home Monitoring, constitute the entire
        agreement between you and Nemara regarding the Service and
        supersede any prior or contemporaneous agreements.
      </p>

      <h2 className="mt-10 font-serif text-2xl">15. Contact</h2>
      <p className="mt-3 text-ink2">
        Questions about these Terms can be directed to:
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

      <h2 className="mt-10 font-serif text-2xl">Acknowledgment</h2>
      <p className="mt-3 text-ink2">
        By accepting these Terms, you acknowledge that you have read,
        understood, and agree to be bound by the Nemara Wellness Terms
        of Use. You specifically acknowledge that:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>
          Nemara is a general wellness service, not a medical device,
          diagnostic tool, or emergency response system.
        </li>
        <li>
          You will not rely on Nemara for the detection of medical
          events or emergencies.
        </li>
        <li>
          Nemara provides no guarantee that any specific activity,
          event, or condition will be observed or surfaced by the
          Service.
        </li>
        <li>
          You have read and accepted the limitations of liability and
          indemnification provisions above.
        </li>
      </ul>

      <p className="mt-12 text-sm text-ink3">
        See also our{' '}
        <Link href="/privacy" className="text-terra underline">
          Privacy Notice
        </Link>
        .
      </p>
    </main>
  );
}
