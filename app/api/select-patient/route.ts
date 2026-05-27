import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { SELECTED_PATIENT_COOKIE } from '@/lib/server/patientSession';

/// POST /api/select-patient { patient_id: string }
///
/// Writes the `selected_patient_id` cookie used by patientSession()
/// on subsequent server renders. The client component
/// PatientSwitcher hits this, then calls router.refresh() so the
/// server components re-resolve with the new selection.
///
/// We don't validate that the patient_id belongs to the caregiver —
/// patientSession() already cross-checks against the patient list
/// returned by the backend (which is itself caregiver-scoped). A
/// bogus cookie value just falls back to patients[0].
export async function POST(req: NextRequest) {
  let body: { patient_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const patientId = body.patient_id;
  if (typeof patientId !== 'string' || patientId.length === 0) {
    return NextResponse.json({ error: 'patient_id_required' }, { status: 400 });
  }

  const jar = await cookies();
  jar.set(SELECTED_PATIENT_COOKIE, patientId, {
    httpOnly: false,
    sameSite: 'lax',
    secure: true,
    path: '/',
    // ~1 year — selection should persist across sessions.
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true });
}
