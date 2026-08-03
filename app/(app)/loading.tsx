export default function Loading() {
  return (
    <div className="anim-in mx-auto w-full max-w-xl flex-1 px-6 py-8">
      <div className="h-24 animate-pulse rounded-3xl bg-card-alt" />
      <div className="mt-5 h-5 w-3/4 animate-pulse rounded bg-card-alt" />
      <div className="mt-2 h-5 w-1/2 animate-pulse rounded bg-card-alt" />
    </div>
  );
}
