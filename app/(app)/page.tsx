import { redirect } from 'next/navigation';

/// The app opens on the family Home view (reassurance-first). The
/// operational roster lives at /patients.
export default function RootPage() {
  redirect('/home');
}
