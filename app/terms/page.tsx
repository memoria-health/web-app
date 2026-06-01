import Link from 'next/link';

export const metadata = {
  title: 'Wellness Terms of Use — Memoria',
  description:
    'The Memoria Wellness Terms of Use, including critical safety, liability, dispute resolution, and use disclaimers.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-ink">
      <nav className="mb-8 text-sm">
        <Link href="/login" className="text-terra underline">
          ← Back to Memoria
        </Link>
      </nav>

      <h1 className="font-serif text-4xl tracking-tight">
        Memoria Wellness Terms of Use
      </h1>
      <p className="mt-2 text-sm text-ink3">
        Effective Date: May 26, 2026 · Last Revised: May 26, 2026
      </p>

      <p className="mt-6 text-ink2">
        These Wellness Terms of Use (these &ldquo;<strong>Terms</strong>&rdquo;)
        constitute a binding legal agreement between you (&ldquo;
        <strong>you</strong>&rdquo; or &ldquo;<strong>User</strong>&rdquo;)
        and Darda and Cui, Inc., a Delaware corporation doing business
        as &ldquo;Memoria&rdquo; (&ldquo;<strong>Memoria</strong>,&rdquo;
        &ldquo;<strong>we</strong>,&rdquo; &ldquo;<strong>us</strong>,&rdquo;
        or &ldquo;<strong>our</strong>&rdquo;).
        These Terms govern your access to and use of the Service
        described below. Please read these Terms carefully. They
        contain important provisions concerning the nature of the
        Service, our and your respective responsibilities, the
        limitations of our liability, and the resolution of disputes,
        including an agreement to arbitrate and a waiver of class
        actions.
      </p>

      <section className="mt-8 rounded-lg border border-terra/40 bg-terra-soft p-5">
        <h2 className="font-serif text-xl text-terra-deep">
          Important — please read carefully
        </h2>
        <p className="mt-2 text-sm text-terra-deep">
          THE SERVICE IS A GENERAL WELLNESS PRODUCT. IT IS{' '}
          <strong>NOT A MEDICAL DEVICE</strong>, IS{' '}
          <strong>NOT AN EMERGENCY RESPONSE SYSTEM</strong>, AND
          PROVIDES <strong>NO GUARANTEE</strong> THAT ANY GIVEN EVENT
          OR CONDITION WILL BE DETECTED. DO NOT RELY ON THE SERVICE
          FOR THE SAFETY OF ANY PERSON WHOSE WELL-BEING DEPENDS UPON
          PROMPT HUMAN INTERVENTION.
        </p>
      </section>

      <h2 className="mt-10 font-serif text-2xl">1. Acceptance of these Terms</h2>
      <p className="mt-3 text-ink2">
        You accept these Terms by (a) signing the Consent to In-Home
        Monitoring form or (b) using the Service in any manner. If you
        do not agree to these Terms, you may not access or use the
        Service. Your continued use of the Service following the
        posting of any update to these Terms constitutes your
        acceptance of such update. If you are entering into these
        Terms on behalf of another person or legal entity, you
        represent and warrant that you have the authority to bind
        such person or entity to these Terms.
      </p>

      <h2 className="mt-10 font-serif text-2xl">2. Definitions</h2>
      <p className="mt-3 text-ink2">
        Capitalized terms used in these Terms have the meanings set
        forth below. Additional capitalized terms used and not
        otherwise defined herein have the meanings ascribed to them
        in the{' '}
        <Link href="/privacy" className="text-terra underline">
          Privacy Notice
        </Link>
        .
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>
          &ldquo;<strong>Account</strong>&rdquo; means an account
          registered by you for access to the Service.
        </li>
        <li>
          &ldquo;<strong>Account Holder</strong>&rdquo; means the
          natural person who registers an Account.
        </li>
        <li>
          &ldquo;<strong>Authorized User</strong>&rdquo; means an
          individual to whom an Account Holder has granted access to
          the Service.
        </li>
        <li>
          &ldquo;<strong>Content</strong>&rdquo; means any data,
          text, output, observations, notifications, or other
          information made available to you through the Service.
        </li>
        <li>
          &ldquo;<strong>Documentation</strong>&rdquo; means any
          documentation, instructions, or guidance made available by
          Memoria in connection with the Service.
        </li>
        <li>
          &ldquo;<strong>Service</strong>&rdquo; means, collectively,
          the Memoria caregiver iOS application, the MemoriaSensor iOS
          application, the web-based Dashboard, the Sensors operating
          under Memoria software, and all related cloud infrastructure,
          application programming interfaces, Documentation, and
          updates made available by Memoria.
        </li>
        <li>
          &ldquo;<strong>Sensor</strong>&rdquo; means an Apple iPhone
          device running the MemoriaSensor application that has been
          paired to an Account for in-home monitoring.
        </li>
        <li>
          &ldquo;<strong>Third-Party Services</strong>&rdquo; means
          any third-party services, integrations, or content made
          available through or used in connection with the Service.
        </li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">3. Eligibility</h2>
      <p className="mt-3 text-ink2">
        You must be at least eighteen (18) years of age and capable
        of forming a binding contract to create an Account. By using
        the Service, you represent and warrant that (a) you meet
        the foregoing age requirement, (b) you have the legal
        authority to install monitoring equipment in the location
        in which you place a Sensor, (c) every person whose audio or
        visual likeness may be captured by a Sensor has consented
        to being monitored (or you are the legal guardian of such
        person and consent on their behalf in accordance with
        applicable law), and (d) you will inform visitors and third
        parties who enter the monitored space that Sensors are in
        use. Recording individuals without their consent may
        violate applicable law in your jurisdiction; you bear sole
        responsibility for compliance.
      </p>

      <h2 className="mt-10 font-serif text-2xl">
        4. The Service is a Wellness Service, not a Medical Device
      </h2>
      <p className="mt-3 text-ink2">
        Memoria is a general wellness service intended to provide
        insights about household activity and routines for
        informational and convenience purposes only. Memoria is{' '}
        <strong>not a medical device</strong> and is not intended to
        diagnose, treat, cure, prevent, or monitor any disease,
        medical condition, or symptom. The Service is not intended
        to be used as a substitute for any medical or clinical
        decision, advice, examination, or treatment by a qualified
        healthcare professional, and is not a substitute for
        in-person caregiving, supervision, or professional medical
        care of any kind.
      </p>

      <h2 className="mt-10 font-serif text-2xl">
        5. Not an Emergency Response System
      </h2>
      <p className="mt-3 text-ink2">
        The Service is not designed or intended to detect, identify,
        or respond to emergencies of any kind, including without
        limitation falls, medical events, fires, intrusions, or other
        urgent situations. The Service does not contact emergency
        services, medical professionals, or any third party on your
        behalf. In the event of an emergency, you must contact local
        emergency services directly (such as 911 in the United
        States or Canada). Do not rely on the Service to alert you,
        anyone in your household, or anyone else to emergencies. You
        acknowledge that the Service may fail to surface, may delay,
        or may inaccurately characterize events of any kind, and
        that you bear sole responsibility for emergency preparedness,
        response, and the safety of household members.
      </p>

      <h2 className="mt-10 font-serif text-2xl">
        6. No Guarantees of Detection or Accuracy
      </h2>
      <p className="mt-3 text-ink2">
        Any insights, observations, summaries, alerts, or
        notifications surfaced by the Service are informational
        only and are provided on a best-effort basis. Memoria makes
        no representations or warranties regarding:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>the accuracy, completeness, reliability, or timeliness of any Content;</li>
        <li>whether the Service will surface or fail to surface any particular activity, event, or condition;</li>
        <li>whether the Service will operate without interruption, delay, or error;</li>
        <li>the continued availability of any feature, capability, integration, or Third-Party Service.</li>
      </ul>
      <p className="mt-3 text-ink2">
        You acknowledge that the Service may produce false positives,
        false negatives, missed signals, inaccurate descriptions, and
        delays, and you agree not to rely on the Service for any
        purpose that requires assurance of detection, accuracy, or
        completeness. Push notifications and other alerts may be
        delayed by the Apple Push Notification service, your mobile
        carrier, your device&rsquo;s settings, do-not-disturb modes,
        network conditions, or other factors beyond Memoria&rsquo;s
        control.
      </p>

      <h2 className="mt-10 font-serif text-2xl">
        7. License Grant; Restrictions on Use
      </h2>
      <p className="mt-3 text-ink2">
        Subject to your continuing compliance with these Terms,
        Memoria grants you a limited, revocable, non-exclusive,
        non-transferable, non-sublicensable license to access and
        use the Service solely for your personal, non-commercial
        in-home monitoring purposes. The Service is licensed, not
        sold, to you. All rights not expressly granted are reserved
        by Memoria.
      </p>
      <p className="mt-3 text-ink2">You shall not, and shall not permit any third party to:</p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>reverse-engineer, decompile, disassemble, or attempt to derive the source code of any portion of the Service;</li>
        <li>circumvent or attempt to circumvent any security, rate-limiting, or access-control mechanism of the Service;</li>
        <li>resell, sublicense, rent, lease, or otherwise commercially exploit the Service without Memoria&rsquo;s prior written consent;</li>
        <li>use the Service to develop a competing product or service;</li>
        <li>use the Service in violation of applicable law, court order, or the rights of any third party.</li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">8. Account Registration and Security</h2>
      <p className="mt-3 text-ink2">
        You are responsible for maintaining the confidentiality of
        your Account credentials and for all activity that occurs
        under your Account. You shall notify Memoria promptly of any
        unauthorized access to or use of your Account, or any other
        breach of security of which you become aware. Memoria shall
        not be liable for any loss or damage arising from your
        failure to comply with this section.
      </p>

      <h2 className="mt-10 font-serif text-2xl">9. Your Responsibilities</h2>
      <p className="mt-3 text-ink2">You agree that you are solely responsible for:</p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>
          <strong>Lawful use.</strong> Using the Service in compliance
          with all applicable laws and regulations in your
          jurisdiction, including laws governing audio recording,
          video surveillance, and privacy.
        </li>
        <li>
          <strong>Notice to others.</strong> Informing all household
          members and visitors that the Service may capture audio
          and video.
        </li>
        <li>
          <strong>Sensor placement.</strong> Placing Sensors only in
          appropriate locations and not in bathrooms, bedrooms used
          by non-consenting individuals, or any other area where a
          person has a reasonable expectation of privacy.
        </li>
        <li>
          <strong>Authorization management.</strong> Managing the
          identity of, and access granted to, each Authorized User.
        </li>
        <li>
          <strong>Emergency response.</strong> Maintaining your own
          arrangements for emergency response and not relying on
          the Service for that purpose.
        </li>
        <li>
          <strong>Network and power.</strong> Maintaining the
          internet connection, power supply, and hardware necessary
          for the Service to operate; the Service may be unavailable
          when these are disrupted.
        </li>
        <li>
          <strong>Content accuracy.</strong> Reviewing Content with
          appropriate skepticism and not making medical, legal, or
          safety decisions based solely on the Service.
        </li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">10. Prohibited Conduct</h2>
      <p className="mt-3 text-ink2">
        You shall not use the Service to:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>record any person who has not consented to being monitored;</li>
        <li>harass, stalk, surveil without consent, or otherwise harm any person;</li>
        <li>impersonate any person or misrepresent your affiliation with any person or entity;</li>
        <li>upload or transmit malicious code, viruses, or other harmful components;</li>
        <li>interfere with or disrupt the integrity or performance of the Service or Third-Party Services;</li>
        <li>violate any applicable law, regulation, court order, or these Terms.</li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">11. Third-Party Services</h2>
      <p className="mt-3 text-ink2">
        The Service relies on Third-Party Services operated by
        independent providers (including without limitation Apple
        Inc., Google LLC, OpenAI L.L.C., LiveKit Cloud, Supabase,
        Inc., Railway Corporation, and Vercel Inc.). Such Third-Party
        Services are governed by their own terms and privacy
        policies. Memoria does not control Third-Party Services and
        is not responsible for their availability, performance,
        terms of service, or actions. Outages, modifications, or
        terminations by Third-Party Services may affect the
        availability or functionality of the Service.
      </p>

      <h2 className="mt-10 font-serif text-2xl">12. Privacy</h2>
      <p className="mt-3 text-ink2">
        Memoria&rsquo;s collection, use, and disclosure of Personal
        Information is governed by the{' '}
        <Link href="/privacy" className="text-terra underline">
          Privacy Notice
        </Link>
        , which is incorporated herein by reference. By using the
        Service, you acknowledge that you have read and agreed to
        the Privacy Notice.
      </p>

      <h2 className="mt-10 font-serif text-2xl">13. Intellectual Property</h2>
      <p className="mt-3 text-ink2">
        The Service and all related software, designs, trademarks,
        service marks, logos, text, graphics, and other materials
        (collectively, the &ldquo;Memoria Materials&rdquo;) are owned
        by Memoria or its licensors and are protected by intellectual-
        property laws of the United States and other jurisdictions.
        No right, title, or interest in or to the Memoria Materials
        is transferred to you under these Terms.
      </p>
      <p className="mt-3 text-ink2">
        Memoria welcomes feedback and suggestions about the Service.
        If you provide any feedback or suggestions, you hereby grant
        Memoria an irrevocable, perpetual, worldwide, royalty-free,
        sublicensable license to use such feedback and suggestions
        for any purpose without obligation or compensation to you.
      </p>

      <h2 className="mt-10 font-serif text-2xl">
        14. Disclaimers; AS-IS Service
      </h2>
      <p className="mt-3 text-ink2 uppercase">
        THE SERVICE IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND
        &ldquo;AS AVAILABLE&rdquo; BASIS, WITH ALL FAULTS AND
        WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED,
        STATUTORY, OR OTHERWISE. TO THE FULLEST EXTENT PERMITTED BY
        APPLICABLE LAW, NEMARA AND ITS AFFILIATES, OFFICERS,
        DIRECTORS, EMPLOYEES, AGENTS, LICENSORS, AND SUPPLIERS
        (COLLECTIVELY, THE &ldquo;NEMARA PARTIES&rdquo;) DISCLAIM
        ALL WARRANTIES, INCLUDING WITHOUT LIMITATION THE IMPLIED
        WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
        PURPOSE, TITLE, AND NON-INFRINGEMENT, AND ANY WARRANTIES
        ARISING FROM COURSE OF DEALING, COURSE OF PERFORMANCE, OR
        USAGE OF TRADE.
      </p>
      <p className="mt-3 text-ink2 uppercase">
        THE NEMARA PARTIES DO NOT WARRANT THAT THE SERVICE WILL MEET
        YOUR REQUIREMENTS, OPERATE WITHOUT INTERRUPTION, BE
        ERROR-FREE, BE SECURE FROM UNAUTHORIZED ACCESS, OR DETECT
        ANY PARTICULAR ACTIVITY OR EVENT. NO ADVICE OR INFORMATION,
        WHETHER ORAL OR WRITTEN, OBTAINED BY YOU FROM NEMARA OR
        THROUGH THE SERVICE SHALL CREATE ANY WARRANTY NOT EXPRESSLY
        STATED IN THESE TERMS.
      </p>

      <h2 className="mt-10 font-serif text-2xl">15. Limitation of Liability</h2>
      <p className="mt-3 text-ink2 uppercase">
        TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO
        EVENT WILL THE NEMARA PARTIES BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE
        DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF
        PROFITS, REVENUE, GOODWILL, DATA, USE, OR OTHER INTANGIBLE
        LOSSES, ARISING OUT OF OR RELATING TO THESE TERMS OR YOUR
        ACCESS TO OR USE OF (OR INABILITY TO ACCESS OR USE) THE
        SERVICE, REGARDLESS OF THE THEORY OF LIABILITY (CONTRACT,
        TORT, OR OTHERWISE) AND EVEN IF A NEMARA PARTY HAS BEEN
        ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p className="mt-3 text-ink2 uppercase">
        IN NO EVENT WILL THE AGGREGATE LIABILITY OF THE NEMARA
        PARTIES ARISING OUT OF OR RELATING TO THESE TERMS OR THE
        SERVICE EXCEED THE GREATER OF (A) THE TOTAL AMOUNTS PAID BY
        YOU TO NEMARA FOR THE SERVICE DURING THE TWELVE (12) MONTHS
        PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE
        HUNDRED CANADIAN DOLLARS (CAD $100).
      </p>
      <p className="mt-3 text-ink2">
        Certain jurisdictions do not allow the exclusion or
        limitation of incidental, consequential, or other damages,
        so the above exclusions and limitations may not apply to
        you. In such jurisdictions, our liability is limited to the
        maximum extent permitted by applicable law. You acknowledge
        that the limitations of liability set forth in this section
        are an essential element of the bargain between you and
        Memoria and that, absent such limitations, Memoria would not
        provide the Service to you.
      </p>

      <h2 className="mt-10 font-serif text-2xl">16. Indemnification</h2>
      <p className="mt-3 text-ink2">
        You agree to defend, indemnify, and hold harmless the Memoria
        Parties from and against any and all claims, demands,
        actions, damages, losses, liabilities, settlements, costs,
        and expenses (including reasonable attorneys&rsquo; fees and
        costs of litigation) arising out of or in any way related to:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>your access to or use of (or misuse of) the Service;</li>
        <li>your violation of these Terms or any applicable law;</li>
        <li>any claim by a third party (including a household member, Monitored Person, or visitor) arising from the operation of a Sensor or the Service in your home, including without limitation claims related to recording, audio capture, privacy, defamation, or consent;</li>
        <li>your reliance on the Service for any purpose for which it is not intended;</li>
        <li>your violation of the rights of any third party.</li>
      </ul>
      <p className="mt-3 text-ink2">
        Memoria reserves the right, at its own expense, to assume the
        exclusive defense and control of any matter otherwise
        subject to indemnification by you, in which event you will
        cooperate with Memoria in asserting any available defenses.
      </p>

      <h2 className="mt-10 font-serif text-2xl">17. Modifications to the Service</h2>
      <p className="mt-3 text-ink2">
        Memoria may, in its sole discretion and at any time, modify,
        suspend, or discontinue the Service or any portion or
        feature of the Service, with or without notice. Memoria shall
        not be liable to you or any third party for any such
        modification, suspension, or discontinuation.
      </p>

      <h2 className="mt-10 font-serif text-2xl">18. Modifications to these Terms</h2>
      <p className="mt-3 text-ink2">
        Memoria may amend these Terms from time to time. We will
        notify you of material amendments through the Service or by
        other reasonable means. The &ldquo;Last Revised&rdquo; date
        at the top of these Terms indicates when they were last
        updated. Your continued use of the Service following any
        amendment constitutes your acceptance of the amended Terms.
        If you do not agree to an amendment, your sole remedy is to
        discontinue use of the Service and close your Account.
      </p>

      <h2 className="mt-10 font-serif text-2xl">19. Termination</h2>
      <p className="mt-3 text-ink2">
        You may terminate these Terms at any time by ceasing to use
        the Service and closing your Account. Memoria may suspend or
        terminate your access to the Service at any time, with or
        without notice, for any reason or no reason, including if
        Memoria reasonably believes you have violated these Terms or
        are using the Service in an unsafe manner. Upon termination,
        the rights granted to you under these Terms shall
        immediately cease, but the provisions of these Terms that
        by their nature should survive termination shall survive,
        including without limitation Sections 6 (No Guarantees), 13
        (Intellectual Property), 14 (Disclaimers), 15 (Limitation
        of Liability), 16 (Indemnification), 20 (Dispute
        Resolution), 22 (Governing Law), and 28 (Survival).
      </p>

      <h2 className="mt-10 font-serif text-2xl">
        20. Dispute Resolution; Binding Arbitration
      </h2>
      <p className="mt-3 text-ink2 uppercase">
        Please read this section carefully. It affects your legal
        rights and provides for resolution of most disputes through
        binding individual arbitration rather than court trials or
        class actions.
      </p>
      <p className="mt-3 text-ink2">
        Any dispute, claim, or controversy arising out of or
        relating to these Terms or the Service (a &ldquo;
        <strong>Dispute</strong>&rdquo;) shall be resolved by final
        and binding individual arbitration administered under the
        commercial arbitration rules of a recognized arbitration
        body in your jurisdiction, rather than in court, except
        that (a) you may assert claims in small-claims court if
        your claims qualify and you proceed only on an individual
        (non-class) basis, and (b) either party may seek injunctive
        or other equitable relief in court for actual or threatened
        infringement, misappropriation, or violation of
        intellectual-property rights.
      </p>
      <p className="mt-3 text-ink2">
        The arbitration shall be conducted in the English language.
        The arbitrator&rsquo;s award shall be final and binding and
        may be entered in any court of competent jurisdiction.
        Where binding arbitration or class-action waivers are not
        permitted under applicable law, those provisions shall not
        apply, but the remainder of these Terms shall continue in
        full force and effect.
      </p>

      <h2 className="mt-10 font-serif text-2xl">21. Class-Action Waiver</h2>
      <p className="mt-3 text-ink2 uppercase">
        YOU AND NEMARA AGREE THAT EACH MAY BRING CLAIMS AGAINST THE
        OTHER ONLY IN AN INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF
        OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE,
        CONSOLIDATED, OR REPRESENTATIVE PROCEEDING. UNLESS BOTH YOU
        AND NEMARA AGREE OTHERWISE, THE ARBITRATOR MAY NOT
        CONSOLIDATE MORE THAN ONE PERSON&rsquo;S CLAIMS AND MAY NOT
        OTHERWISE PRESIDE OVER ANY FORM OF A REPRESENTATIVE OR CLASS
        PROCEEDING.
      </p>

      <h2 className="mt-10 font-serif text-2xl">22. Governing Law</h2>
      <p className="mt-3 text-ink2">
        These Terms shall be governed by and construed in accordance
        with the laws of the State of Delaware, United States,
        without regard to its conflict-of-laws principles. The
        United Nations Convention on Contracts for the International
        Sale of Goods shall not apply. The parties hereby submit to
        the exclusive jurisdiction of the state and federal courts
        located in Delaware for any matters not subject to
        arbitration.
      </p>

      <h2 className="mt-10 font-serif text-2xl">23. Notices</h2>
      <p className="mt-3 text-ink2">
        Memoria may provide notices to you by email to the address
        associated with your Account, by posting within the Service,
        or by any other reasonable means. You shall direct legal
        notices to Memoria by email to{' '}
        <a className="text-terra underline" href="mailto:sunnycui@stanford.edu">
          sunnycui@stanford.edu
        </a>{' '}
        and shall include in the subject line the words &ldquo;LEGAL
        NOTICE.&rdquo; Notices shall be deemed given on the date of
        receipt (in the case of email) or on the date of posting (in
        the case of in-Service notices).
      </p>

      <h2 className="mt-10 font-serif text-2xl">24. Assignment</h2>
      <p className="mt-3 text-ink2">
        You may not assign or transfer these Terms or any of your
        rights or obligations hereunder, in whole or in part, by
        operation of law or otherwise, without Memoria&rsquo;s prior
        written consent, and any attempted assignment in violation
        of the foregoing shall be void. Memoria may freely assign or
        transfer these Terms, in whole or in part, including
        without limitation in connection with a merger, acquisition,
        reorganization, financing, or sale of all or substantially
        all of its assets. These Terms shall be binding upon and
        inure to the benefit of the parties and their respective
        permitted successors and assigns.
      </p>

      <h2 className="mt-10 font-serif text-2xl">25. Waiver and Severability</h2>
      <p className="mt-3 text-ink2">
        No failure or delay by Memoria to exercise any right or
        remedy under these Terms shall operate as a waiver of such
        right or remedy. No waiver of any provision of these Terms
        shall be effective unless made in writing and signed by an
        authorized representative of Memoria. If any provision of
        these Terms is held to be invalid, illegal, or
        unenforceable, that provision shall be limited or
        eliminated to the minimum extent necessary so that the
        remaining provisions shall continue in full force and
        effect.
      </p>

      <h2 className="mt-10 font-serif text-2xl">26. Force Majeure</h2>
      <p className="mt-3 text-ink2">
        Memoria shall not be liable for any failure or delay in
        performance under these Terms to the extent such failure or
        delay is caused by circumstances beyond its reasonable
        control, including without limitation acts of God, natural
        disasters, war, terrorism, riots, civil unrest, government
        action, labor disputes, internet or telecommunications
        outages, cyber-attacks, denial-of-service attacks, or
        outages or failures of Third-Party Services.
      </p>

      <h2 className="mt-10 font-serif text-2xl">27. Relationship of the Parties</h2>
      <p className="mt-3 text-ink2">
        The parties are independent contractors. These Terms do not
        create any agency, partnership, joint venture, employment,
        or fiduciary relationship between you and Memoria. Neither
        party has the authority to bind the other or to incur
        obligations on behalf of the other.
      </p>

      <h2 className="mt-10 font-serif text-2xl">28. Survival</h2>
      <p className="mt-3 text-ink2">
        The provisions of these Terms that by their nature should
        survive termination of these Terms or your use of the
        Service shall so survive, including without limitation
        Sections 4 (Wellness Service), 5 (Not an Emergency Response
        System), 6 (No Guarantees), 13 (Intellectual Property), 14
        (Disclaimers), 15 (Limitation of Liability), 16
        (Indemnification), 20 (Dispute Resolution), 21 (Class-Action
        Waiver), 22 (Governing Law), 23 (Notices), 24 (Assignment),
        25 (Waiver and Severability), 26 (Force Majeure), 27
        (Relationship of the Parties), this Section 28, 29 (Entire
        Agreement), and 30 (Construction).
      </p>

      <h2 className="mt-10 font-serif text-2xl">29. Entire Agreement</h2>
      <p className="mt-3 text-ink2">
        These Terms, together with the{' '}
        <Link href="/privacy" className="text-terra underline">
          Privacy Notice
        </Link>{' '}
        and any Consent to In-Home Monitoring executed by you,
        constitute the entire agreement between you and Memoria with
        respect to the subject matter hereof and supersede all
        prior or contemporaneous agreements, representations,
        warranties, and understandings with respect to such subject
        matter, whether written or oral.
      </p>

      <h2 className="mt-10 font-serif text-2xl">30. Construction</h2>
      <p className="mt-3 text-ink2">
        The section headings used in these Terms are for convenience
        only and shall not affect the interpretation of these Terms.
        The words &ldquo;include,&rdquo; &ldquo;includes,&rdquo;
        and &ldquo;including&rdquo; shall be deemed to be followed
        by the phrase &ldquo;without limitation.&rdquo; These Terms
        shall not be construed against the drafter.
      </p>

      <h2 className="mt-10 font-serif text-2xl">31. Contact</h2>
      <p className="mt-3 text-ink2">
        Questions about these Terms may be directed to the contact
        below:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>Darda and Cui, Inc. (d/b/a Memoria)</li>
        <li>Attn: Legal &mdash; Sunny Cui</li>
        <li>
          Email:{' '}
          <a className="text-terra underline" href="mailto:sunnycui@stanford.edu">
            sunnycui@stanford.edu
          </a>
        </li>
        <li>
          Telephone:{' '}
          <a className="text-terra underline" href="tel:+17166021101">
            716-602-1101
          </a>
        </li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">Acknowledgment</h2>
      <p className="mt-3 text-ink2">
        By accepting these Terms, you acknowledge that you have
        read, understood, and agree to be bound by these Memoria
        Wellness Terms of Use. You specifically acknowledge that:
      </p>
      <ul className="mt-3 list-disc pl-6 text-ink2 space-y-1">
        <li>Memoria is a general wellness service and is not a medical device, diagnostic tool, or emergency response system;</li>
        <li>you will not rely on Memoria for the detection of medical events or emergencies;</li>
        <li>Memoria provides no guarantee that any specific activity, event, or condition will be observed or surfaced by the Service;</li>
        <li>you have read and accepted the limitations of liability, indemnification, dispute resolution, and class-action waiver provisions above.</li>
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
