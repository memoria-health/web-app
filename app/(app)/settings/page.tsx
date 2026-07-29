import Link from 'next/link';
import { patientSession } from '@/lib/server/patientSession';

export const dynamic = 'force-dynamic';

/// Settings — care setup lives here: each person's sensors, detectors and
/// details, plus adding someone new. Families visit once at install.
export default async function SettingsPage() {
  const { patients } = await patientSession();
  return (
    <div className="mx-auto w-full max-w-xl px-6 pb-16 pt-8">
      <h1 className="font-serif text-[24px] font-semibold text-ink">Settings</h1>
      <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-ink4">People</h2>
      <div className="mt-2 space-y-3">
        {patients.map((p) => (
          <div key={p.id} className="rounded-2xl border border-line bg-card px-6 py-4">
            <div className="font-serif text-[18px] font-semibold text-ink">{p.preferred_name || p.full_name}</div>
            <div className="mt-2 flex gap-4 text-[14px]">
              <Link href={`/patients/${p.id}/cameras`} className="text-terra underline">Cameras</Link>
              <Link href={`/patients/${p.id}/detectors`} className="text-terra underline">Detectors</Link>
              <Link href={`/patients/${p.id}/settings`} className="text-terra underline">Advanced settings</Link>
            </div>
          </div>
        ))}
      </div>
      <Link href="/patients/new" className="mt-5 inline-block rounded-full border border-line bg-card px-5 py-2.5 text-[14px] font-medium text-ink2 hover:border-terra/50">
        + Add another person
      </Link>
    </div>
  );
}
