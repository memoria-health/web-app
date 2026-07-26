'use client';

// The scrollable document body for the terms gate: every legal PDF rendered
// page-by-page, stacked in one flow. Loaded ONLY via next/dynamic(ssr:false)
// from TermsGate, so react-pdf / pdfjs (both DOM-dependent) never run on the
// server. Text + annotation layers are disabled — these docs are read-only,
// so a canvas render is enough and avoids the extra CSS + layers.

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { LEGAL_DOCS } from '@/lib/legal';

// Same-origin worker copied into public/ (see the pnpm postinstall note in the
// PR). Static path avoids Turbopack worker-URL resolution quirks.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export default function TermsPdfStack({ width }: { width: number }) {
  return (
    <div className="flex flex-col items-center gap-8">
      {LEGAL_DOCS.map((doc) => (
        <DocBlock key={doc.key} title={doc.title} url={doc.url} width={width} />
      ))}
    </div>
  );
}

function DocBlock({
  title,
  url,
  width,
}: {
  title: string;
  url: string;
  width: number;
}) {
  const [numPages, setNumPages] = useState(0);
  return (
    <section className="w-full">
      <h3 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
        {title}
      </h3>
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={
          <div className="py-10 text-center text-sm text-ink3">Loading {title}…</div>
        }
        error={
          <div className="py-10 text-center text-sm text-terra-deep">
            Couldn&apos;t load {title}. Refresh to try again.
          </div>
        }
        className="flex flex-col items-center gap-2"
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="border border-line shadow-sm"
          />
        ))}
      </Document>
    </section>
  );
}
