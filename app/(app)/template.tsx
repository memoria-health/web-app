/// Route transition — each page rises in briefly on navigation. Server
/// component (no client JS); the CSS class does all the work and
/// prefers-reduced-motion turns it off.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="anim-page flex flex-1 flex-col">{children}</div>;
}
