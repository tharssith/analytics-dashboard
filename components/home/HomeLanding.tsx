import Link from "next/link";
import { HomeCursorField } from "@/components/home/HomeCursorField";

const USES = [
  {
    label: "01",
    title: "Monitor",
    body: "KPIs update from the file you uploaded. Headcount, sales, cost, or any numeric field — same surface.",
  },
  {
    label: "02",
    title: "Diagnose",
    body: "Off-track tiles open a variance read and a department or category breakdown. No extra model to configure.",
  },
  {
    label: "03",
    title: "Forecast",
    body: "A six-month trend with a widening band, plus what-if sliders when the dataset supports them.",
  },
  {
    label: "04",
    title: "Prove",
    body: "Every headline can name the rows that made it — and what the number becomes if those rows are wrong.",
  },
];

const STEPS = [
  { step: "01", title: "Upload", body: "CSV or Excel. Cairn reads headers, types the file, and maps columns." },
  { step: "02", title: "Clean", body: "Invalid dates and values stay visible. AI can fix them, or you edit the sheet." },
  { step: "03", title: "Read", body: "Dashboard tiles, a forecast, and an analysis workspace with shelves and visuals." },
  { step: "04", title: "Decide", body: "Ask the data, watch a claim, export a one-page brief with the swing rows attached." },
];

const SURFACES = [
  {
    name: "Dashboard",
    href: "/dashboard",
    detail: "Tiles, forecast, Ask the data. Click a number to open provenance.",
  },
  {
    name: "Analysis workspace",
    href: "/analytics",
    detail: "Columns, values, color, and filters — then a second opinion on the visual.",
  },
  {
    name: "Upload / editor",
    href: "/upload",
    detail: "Source-row counts, flagged cells, AI prepare, and a spreadsheet that does not drop rows.",
  },
];

export function HomeLanding() {
  return (
    <div className="min-h-full bg-[#08111f] text-slate-100">
      <HomeCursorField />

      <div className="relative">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-[13px] font-semibold tracking-[0.28em] text-white">
            CAIRN
          </Link>
          <nav className="flex items-center gap-6 text-[13px] text-slate-400">
            <a href="#use" className="hidden hover:text-white sm:inline">
              Use
            </a>
            <a href="#method" className="hidden hover:text-white sm:inline">
              Method
            </a>
            <a href="#product" className="hidden hover:text-white sm:inline">
              Product
            </a>
            <Link href="/login" className="hover:text-white">
              Sign in
            </Link>
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-md bg-white px-3.5 text-[13px] font-medium text-[#08111f] hover:bg-slate-200"
            >
              Open Cairn
            </Link>
          </nav>
        </header>

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 sm:pb-28 sm:pt-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-400">
            Operator analytics · v1
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl sm:leading-[1.05]">
            See the number.
            <span className="block text-slate-400">Then see the rows that made it.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
            Cairn is a workspace for any business spreadsheet. It monitors KPIs, diagnoses
            variance, forecasts the next periods — and will tell you when the story is fragile.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-md bg-white px-5 text-sm font-medium text-[#08111f] hover:bg-slate-200"
            >
              Create an account
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-md border border-white/15 px-5 text-sm font-medium text-white hover:border-white/40"
            >
              Sign in
            </Link>
            <span className="text-xs text-slate-500">CSV / Excel · Neon-backed · no warehouse required</span>
          </div>
        </section>

        <section id="use" className="border-t border-white/10">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Main use
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Turn a file into a decision you can defend.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                Most tools stop at a chart. Cairn is for the moment after: is this real, which
                rows drive it, and what happens if those rows are wrong? Upload workforce, sales,
                finance, or operations data. Same product path.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2">
              {USES.map((item) => (
                <article key={item.title} className="bg-[#0d182c] p-5">
                  <p className="font-mono text-[11px] text-slate-500">{item.label}</p>
                  <h3 className="mt-2 text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="method" className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
              What is unique
            </p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Truth-seeking analytics, not another chart builder.
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <article className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-sm font-semibold text-white">Provenance</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Click a KPI. See source rows vs rows used, flagged values that were kept, and
                  the swing rows that move the number the most.
                </p>
              </article>
              <article className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-sm font-semibold text-white">Second opinion</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  A falsifiable claim on the visual: the story holds, or it reverses if you
                  exclude three rows. No vibe. Row identity.
                </p>
              </article>
              <article className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-sm font-semibold text-white">Contradiction watch</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Save a claim. The next upload rechecks it and tells you if last week’s driver
                  is no longer true.
                </p>
              </article>
              <article className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-sm font-semibold text-white">Decision brief</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  One-page export: what changed, which rows, claim status, what to do. Excel,
                  PowerPoint, and PDF stay available.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Path
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Four steps. File in, brief out.
            </h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item) => (
                <li key={item.step} className="border-t border-white/15 pt-4">
                  <p className="font-mono text-[11px] text-slate-500">{item.step}</p>
                  <h3 className="mt-2 text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="product" className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Inside the product
            </p>
            <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
              {SURFACES.map((item) => (
                <div key={item.name} className="grid gap-2 py-5 sm:grid-cols-[200px_1fr_auto] sm:items-center">
                  <p className="text-sm font-semibold text-white">{item.name}</p>
                  <p className="text-sm leading-6 text-slate-400">{item.detail}</p>
                  <Link href="/login" className="text-[13px] text-slate-300 hover:text-white">
                    Sign in to open →
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-2xl text-sm leading-6 text-slate-500">
              Built for operators and analysts who cannot take a dashboard on faith. Stack:
              Next.js, Neon Postgres, and an optional Grok panel that answers only from the
              filtered rows in front of you.
            </p>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-16 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Load a file. Challenge the chart.
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Create an account, then upload CSV or Excel. Seed HR data is there if you want a walkthrough first.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex h-11 shrink-0 items-center rounded-md bg-white px-5 text-sm font-medium text-[#08111f] hover:bg-slate-200"
            >
              Start with Cairn
            </Link>
          </div>
        </section>

        <footer className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-[12px] text-slate-500">
            <p>Cairn · monitor, diagnose, forecast, prove</p>
            <p className="font-mono">analytics-dashboard-pearl-pi.vercel.app</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
