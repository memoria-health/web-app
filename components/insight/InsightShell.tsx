'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, ChevronDown, House, LayoutDashboard, MessageCircle, PanelLeft, Pin, Sparkles, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePatients } from '@/app/_components/PatientProvider';
import {
  ActivityTrendCard,
  DetectionCountsCard,
  GenerativeView,
  LeaderboardCard,
  PatientsCard,
  TimelineCard,
  UptimeCard,
} from '@/components/insight/charts';
import { Dashboard } from '@/components/insight/dashboard';
import { WidgetBody, WidgetConfigChat } from '@/components/insight/widgets';
import { saveWidget, updateWidget, type Widget } from '@/lib/insight/widgets';
import { pinView } from '@/lib/insight/pins';

const SUGGESTIONS = [
  'How has Maggie’s activity changed over the last 2 weeks?',
  'Show me Joey’s detections this week',
  'Any wandering events for Margaret this month?',
  'Are all of Maggie’s cameras healthy?',
];

/* How each tool derives its data — shown to the caregiver so the method is
 * never a black box. Descriptions are FIXED text tied to the actual query. */
const TOOL_METHOD: Record<string, string> = {
  getActivityTrend:
    'analyses table — for each day, the % of monitored camera windows that showed motion while someone was present',
  getDetectionCounts: 'events table — daily counts of safety events, grouped by category',
  getUptime: 'analyses timestamps — % of hours per camera that produced monitoring data',
  getEventTimeline: 'events table — the most recent safety events with their AI-written narratives',
  getEventLeaderboard: 'events table — one aggregate count per patient, grouped by category',
  listPatients: 'patients + cameras tables',
};

function rowCount(toolName: string, o: any): number | null {
  if (!o) return null;
  return (
    o.series?.length ?? o.events?.length ?? o.cameras?.length ?? o.ranking?.length ?? o.rows?.length ?? (Array.isArray(o) ? o.length : null)
  );
}

/* Deterministic provenance — built from the REAL tool invocation, not the model. */
function Provenance({ toolName, input, output }: { toolName: string; input: any; output: any }) {
  const n = rowCount(toolName, output);
  const args = [
    output?.patient && `patient: ${output.patient}`,
    (input?.days ?? output?.days) && `window: last ${input?.days ?? output?.days} days`,
    input?.type && `category: ${input.type}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <details className="mt-1 px-1">
      <summary className="cursor-pointer list-none text-[11px] text-ink4 hover:text-ink3">
        ⓘ How this was pulled — <code className="font-mono">{toolName}</code>
        {n != null && ` · ${n} row${n === 1 ? '' : 's'}`}
      </summary>
      <div className="mt-1 rounded-lg border border-line bg-card-alt/50 px-3 py-2 text-[11.5px] leading-relaxed text-ink3">
        A fixed, pre-written database query ({TOOL_METHOD[toolName] ?? 'internal data'}).
        {args && <> Parameters the assistant chose: {args}.</>}{' '}
        The assistant picked this query and filled the parameters — it cannot write its own
        queries, and the database connection is read-only. Every number above comes from
        these rows; the written summary is generated only from them.
      </div>
    </details>
  );
}

/* Map each tool's output to its card — the "palette" the assistant builds from. */
function ToolCard({ toolName, input, output }: { toolName: string; input: any; output: any }) {
  if (output?.error) {
    // AMBIGUOUS errors are instructions to the MODEL (they contain ids and
    // retry directions) — the caregiver sees the clarification chips instead
    if (String(output.error).startsWith('AMBIGUOUS')) return null;
    return <div className="rounded-xl border border-terra/40 bg-terra-soft px-3 py-2 text-[13px] text-terra-deep">{output.error}</div>;
  }
  let card: React.ReactNode = null;
  switch (toolName) {
    case 'getActivityTrend':
      card = <ActivityTrendCard data={output} />; break;
    case 'getDetectionCounts':
      card = <DetectionCountsCard data={output} />; break;
    case 'getUptime':
      card = <UptimeCard data={output} />; break;
    case 'getEventTimeline':
      card = <TimelineCard data={output} />; break;
    case 'getEventLeaderboard':
      card = <LeaderboardCard data={output} />; break;
    case 'listPatients':
      card = <PatientsCard data={output} />; break;
    default:
      return null;
  }
  return (
    <div>
      {card}
      <Provenance toolName={toolName} input={input} output={output} />
    </div>
  );
}

export function InsightShell() {
  const { messages, sendMessage, status } = useChat({ transport: new DefaultChatTransport({ api: '/api/insight/chat' }) });
  const [input, setInput] = useState('');
  const [patients, setPatients] = useState<{ id: string; name: string; preferred: string; room?: string }[]>([]);
  const [scope, setScope] = useState<string>(''); // '' = all patients
  const [view, setView] = useState<'home' | 'chat' | 'dashboard'>('chat'); // Home lives at the app's top level now
  const [navOpen, setNavOpen] = useState(false);
  // widget being configured via the SIDE drawer (set by dropping a shape or a
  // widget's chat icon) — the user never leaves the dashboard
  const [configuring, setConfiguring] = useState<Widget | null>(null);
  const [drawerClosed, setDrawerClosed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === 'submitted' || status === 'streaming';

  // auto-grow the composer with the text, capped at 5 lines (then scroll)
  const autoResize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const line = parseFloat(getComputedStyle(ta).lineHeight) || 22;
    const max = line * 5;
    ta.style.height = `${Math.min(ta.scrollHeight, max)}px`;
    ta.style.overflowY = ta.scrollHeight > max ? 'auto' : 'hidden';
  };

  const provided = usePatients();
  useEffect(() => {
    setPatients(provided.map((p) => ({ id: p.id, name: p.full_name, preferred: p.preferred_name })));
  }, [provided]);

  // Scroll ONLY the chat column. scrollIntoView scrolls every scrollable
  // ancestor (incl. the body — which extension-injected elements next to our
  // <video>s can stretch), which is how the page got yanked to the void.
  // Also: don't yank if the caregiver has scrolled up to read.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const ask = (text: string) => {
    if (!text.trim() || busy) return;
    // scope rides along with every message; server hard-scopes tools to it
    sendMessage({ text }, { body: { patient: scope || null } });
    setInput('');
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (ta) { ta.style.height = 'auto'; ta.style.overflowY = 'hidden'; }
    });
  };

  const selector = (
    <label className="relative flex items-center">
      <Users size={14} className="pointer-events-none absolute left-3 text-terra" />
      <select
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        className={`appearance-none rounded-full border py-1.5 pl-8 pr-8 text-[12px] outline-none transition-colors ${
          scope ? 'border-terra bg-terra-soft text-terra-deep' : 'border-line bg-card text-ink2'
        }`}
      >
        <option value="">All patients</option>
        {patients.map((p) => {
          const label = p.preferred || p.name;
          const dup = patients.filter((q) => (q.preferred || q.name) === label).length > 1;
          return (
            <option key={p.id} value={p.id}>
              {dup ? `${label} · ${p.room ?? p.id.slice(0, 4)}` : label}
            </option>
          );
        })}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 text-ink4" />
    </label>
  );

  const NAV = [
    { k: 'chat' as const, icon: MessageCircle, label: 'Chat' },
    { k: 'dashboard' as const, icon: LayoutDashboard, label: 'Explore' },
  ];

  return (
    <div className="flex h-full">
      {/* left navbar — collapsed icon rail, expandable for labels */}
      <nav className={`flex h-full shrink-0 flex-col border-r border-line bg-card transition-[width] duration-200 ${navOpen ? 'w-44' : 'w-14'}`}>
        <button
          onClick={() => setNavOpen((v) => !v)}
          className="m-2 flex h-9 w-9 items-center justify-center rounded-xl text-ink4 hover:bg-card-alt hover:text-ink2"
          aria-label="Toggle navigation"
        >
          <PanelLeft size={17} />
        </button>
        <div className="mt-2 flex flex-col gap-1 px-2">
          {NAV.map(({ k, icon: Icon, label }) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-colors ${
                view === k ? 'bg-terra-soft text-terra-deep' : 'text-ink3 hover:bg-card-alt'
              }`}
            >
              <Icon size={17} className="shrink-0" />
              {navOpen && <span>{label}</span>}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {navOpen && <div className="px-4 pb-4 font-serif text-[13px] font-semibold text-ink4">Memoria</div>}
      </nav>

      {/* chat pane (default view; stays mounted so the conversation survives switching) */}
      <div className={view === 'chat' ? 'mx-auto flex h-full w-full max-w-3xl flex-col px-4' : 'hidden'}>
      <header className="flex items-center justify-between gap-3 py-5">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Memoria Insight</h1>
          <p className="text-[13px] text-ink3">Ask anything about your loved one’s day.</p>
        </div>
        <div className="flex items-center gap-2">
          {selector}
          <span className="rounded-full border border-line bg-card px-3 py-1 text-[11px] text-ink4">
            prototype
          </span>
        </div>
      </header>

      <main ref={mainRef} className="relative flex-1 space-y-5 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="mt-14 text-center">
            <Sparkles className="mx-auto mb-3 text-terra" size={22} />
            <p className="mx-auto mb-6 max-w-sm font-serif text-lg text-ink2">
              Type a question — I’ll pull the data and build the view for you.
            </p>
            <div className="mx-auto flex max-w-md flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-xl border border-line bg-card px-4 py-2.5 text-left text-[13px] text-ink2 transition-colors hover:border-terra hover:bg-terra-soft"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
            {m.role === 'user' ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-action px-4 py-2.5 text-[14px] text-terra-ink">
                {m.parts.map((p, i) => (p.type === 'text' ? <span key={i}>{p.text}</span> : null))}
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  // when the assistant composed a custom view, the raw data
                  // cards would duplicate it — show only their provenance
                  const hasCustomView = m.parts.some(
                    (p: any) => p.type === 'tool-renderView' && (p.state === 'output-available' || p.state === 'input-available'),
                  );
                  return m.parts.map((p: any, i) => {
                    if (p.type === 'text' && p.text.trim())
                      return (
                        <div key={i} className="max-w-[92%] space-y-2 text-[14px] leading-relaxed text-ink2 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5">
                          <ReactMarkdown>{p.text}</ReactMarkdown>
                        </div>
                      );
                    if (p.type === 'tool-askUser' && (p.state === 'input-available' || p.state === 'output-available')) {
                      // generative-UI clarification: question + tappable chips
                      return (
                        <div key={i} className="rounded-2xl border border-line bg-card p-4">
                          <p className="mb-3 text-[14px] text-ink2">{p.input?.question}</p>
                          <div className="flex flex-wrap gap-2">
                            {(p.input?.options ?? []).map((opt: string) => (
                              <button
                                key={opt}
                                onClick={() => ask(opt)}
                                disabled={busy}
                                className="rounded-full border border-line bg-card-alt/60 px-3.5 py-1.5 text-[13px] text-ink2 transition-colors hover:border-terra hover:bg-terra-soft disabled:opacity-40"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (p.type === 'tool-designWidget' && p.state === 'output-available') {
                      const dws = m.parts.filter(
                        (x: any) => x.type === 'tool-designWidget' && x.state === 'output-available',
                      );
                      if (p !== dws[dws.length - 1]) return null; // iterate → latest preview wins
                      const spec = p.input;
                      return (
                        <div key={i} className="rounded-2xl border border-terra/50 bg-card p-4">
                          <div className="mb-1 flex items-center justify-between">
                            <h3 className="font-serif text-[15px] font-semibold text-ink2">{spec.title}</h3>
                            <span className="rounded-full bg-terra-soft px-2 py-0.5 text-[10px] font-medium text-terra-deep">widget preview · live data</span>
                          </div>
                          <p className="mb-2 text-[11px] text-ink4">
                            {spec.source?.patientLabel || 'All patients'} · last {spec.source?.days} days · by {spec.source?.granularity}
                          </p>
                          <WidgetBody source={spec.source} viz={spec.viz} expanded={false} />
                          <div className="mt-2.5 flex items-center gap-2">
                            <button
                              onClick={() => {
                                saveWidget({ title: spec.title, source: spec.source, viz: spec.viz, expanded: false, size: 'm' });
                                setView('dashboard');
                              }}
                              className="rounded-full bg-action px-3.5 py-1.5 text-[12px] font-medium text-terra-ink hover:opacity-85"
                            >
                              Add to dashboard
                            </button>
                            <span className="text-[11px] text-ink4">or keep prompting to change it</span>
                          </div>
                        </div>
                      );
                    }
                    if (p.type === 'tool-renderView' && p.state === 'output-available') {
                      // render only the LAST composed view (the model's final
                      // refinement) — earlier ones caused the 'cycling charts'
                      const views = m.parts.filter(
                        (x: any) => x.type === 'tool-renderView' && x.state === 'output-available',
                      );
                      if (p !== views[views.length - 1]) return null;
                      return (
                        <div key={i}>
                          <GenerativeView spec={p.input} />
                          <button
                            onClick={() => pinView(p.input)}
                            className="mt-1 flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-[11px] text-ink3 transition-colors hover:border-terra hover:bg-terra-soft"
                          >
                            <Pin size={11} /> Pin to dashboard
                          </button>
                        </div>
                      );
                    }
                    if (p.type?.startsWith('tool-')) {
                      const name = p.type.slice(5);
                      if (p.state === 'output-available') {
                        if (hasCustomView)
                          return <Provenance key={i} toolName={name} input={p.input} output={p.output} />;
                        return <ToolCard key={i} toolName={name} input={p.input} output={p.output} />;
                      }
                      if (p.state === 'input-available' || p.state === 'input-streaming')
                        return (
                          <div key={i} className="flex items-center gap-2 text-[12px] text-ink4">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-terra" />
                            {name === 'renderView' ? 'composing the view…' : `pulling ${name.replace(/^get/, '').replace(/([A-Z])/g, ' $1').toLowerCase()}…`}
                          </div>
                        );
                    }
                    return null;
                  });
                })()}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-[12px] text-ink4">
            <span className="h-2 w-2 animate-pulse rounded-full bg-terra" />
            {messages[messages.length - 1]?.role === 'user' ? 'thinking…' : 'still working — more coming…'}
          </div>
        )}
      </main>

      <footer className="pb-5 pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2 rounded-2xl border border-line bg-card p-2 pl-4 shadow-[0_1px_3px_rgba(28,26,20,0.08)]"
        >
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              // Enter sends · Shift+Enter inserts a newline
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            placeholder={
              scope
                ? `Asking about ${patients.find((p) => p.id === scope)?.preferred || 'this patient'} — e.g. “How was activity this week?”`
                : 'e.g. “Show me the change in Maggie’s activity this month”'
            }
            className="flex-1 resize-none overflow-y-hidden bg-transparent text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink4"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-action text-terra-ink transition-opacity disabled:opacity-30"
            aria-label="Send"
          >
            <ArrowUp size={16} />
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-ink4">
          Numbers come only from the data tools — the assistant never invents figures. Demo data, no real patients.
        </p>
      </footer>
      </div>

      {/* dashboard — full view (stays MOUNTED when you switch to chat, so
          widget builds keep running) */}
      <section className={view === 'dashboard' ? 'flex h-full flex-1 flex-col' : 'hidden'}>
          <div className="flex items-center justify-between border-b border-line px-6 py-3.5">
            <h1 className="font-serif text-xl font-semibold text-ink">Memoria Insight</h1>
            {selector}
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1">
              <Dashboard patients={patients} onEditWidget={(w: Widget) => { setConfiguring(w); setDrawerClosed(false); }} />
            </div>
            {configuring && (
              <WidgetConfigChat
                key={configuring.id}
                widget={configuring}
                hidden={drawerClosed || view !== 'dashboard'}
                finishWhenClosed={drawerClosed}
                onClose={() => setDrawerClosed(true)}
                onFinished={() => { setConfiguring(null); setDrawerClosed(false); }}
              />
            )}
          </div>
        </section>
    </div>
  );
}
