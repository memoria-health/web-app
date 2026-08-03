/// Instant skeleton while the person's Live page loads server-side —
/// navigation paints immediately instead of freezing then snapping.
export default function Loading() {
  return (
    <div className="anim-in mx-auto w-full max-w-7xl flex-1 px-6 py-6">
      <div className="h-8 w-44 animate-pulse rounded-lg bg-card-alt" />
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="aspect-video animate-pulse rounded-2xl bg-card-alt" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
      <div className="mt-5 h-24 animate-pulse rounded-2xl bg-card-alt" />
    </div>
  );
}
