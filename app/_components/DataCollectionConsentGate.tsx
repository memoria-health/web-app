'use client';

import { useState } from 'react';
import { DataCollectionConsentModal } from './DataCollectionConsentModal';

/// Client wrapper that decides whether to show the first-open consent
/// modal. The patient detail page (a server component) renders this and
/// passes the patient's `data_collection_decided_at`. Rule: a null
/// decided_at means the caregiver has never been asked, so we show the
/// modal. Once they decide (either button), the modal calls back here
/// and we hide it for the rest of the session — the backend has stamped
/// decided_at, so it won't re-appear on the next load either.
export function DataCollectionConsentGate({
  patientId,
  patientName,
  initialDecidedAt,
}: {
  patientId: string;
  patientName: string;
  initialDecidedAt: string | null;
}) {
  const [show, setShow] = useState(initialDecidedAt == null);

  if (!show) return null;

  return (
    <DataCollectionConsentModal
      patientId={patientId}
      patientName={patientName}
      onDecide={() => setShow(false)}
    />
  );
}
