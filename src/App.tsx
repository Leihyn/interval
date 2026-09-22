import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { THRESHOLDS } from "../convex/thresholds";
import { AUTO_REPLIES } from "../convex/gate";

const LEVEL_LABEL = { RED: "Contact now", AMBER: "Review today", GREEN: "Logged" } as const;

const SOURCE_LABEL: Record<string, string> = {
  parser: "read by parser",
  model: "read by OpenAI",
  merged: "parser + OpenAI",
};

function timeAgo(ts: number) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

export default function App() {
  const board = useQuery(api.replies.board);
  const patients = useQuery(api.patients.list);
  const seed = useMutation(api.seed.demo);
  const submit = useAction(api.replies.submitReply);
  const acknowledge = useMutation(api.replies.acknowledge);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patient = patients?.[0];
  const counts = {
    red: board?.filter((c) => c.level === "RED").length ?? 0,
    amber: board?.filter((c) => c.level === "AMBER").length ?? 0,
    green: board?.filter((c) => c.level === "GREEN").length ?? 0,
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!patient || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      await submit({ email: patient.email, rawText: reply, channel: "paste" });
      setReply("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="shell">
      <header className="head">
        <div>
          <p className="eyebrow">Interval</p>
          <h1>Clinic board</h1>
          <p className="lede">
            Patients answer their home programme, drugs and vitals by replying to an email.
            The clinic sees it live.
          </p>
        </div>
        <button className="ghost" onClick={() => void seed({})}>Reset demo</button>
      </header>

      <section className="proof">
        <div className="stat"><b className="red">{counts.red}</b><span>contact now</span></div>
        <div className="stat"><b className="amber">{counts.amber}</b><span>review today</span></div>
        <div className="stat"><b className="green">{counts.green}</b><span>logged</span></div>
        <div className="pipeline">
          <span><b>OpenAI</b> reads the reply</span>
          <span className="arrow">→</span>
          <span><b>code</b> decides the level</span>
          <span className="arrow">→</span>
          <span><b>AgentMail</b> replies</span>
          <span className="arrow">·</span>
          <span><b>Firecrawl</b> checks the citation</span>
        </div>
      </section>

      <p className="notice">
        Synthetic patient records only. This is not a monitoring service and not an emergency
        channel.
      </p>

      {patients?.length === 0 && (
        <p className="lede">No patients yet. Press <strong>Reset demo</strong>.</p>
      )}

      {patient && (
        <>
          <section className="panel">
            <h2>{patient.name}</h2>
            {patient.clerkingNote && <p className="note">{patient.clerkingNote}</p>}
            <div className="chips">
              {patient.painCeiling !== undefined && (
                <span className="chip">pain ceiling {patient.painCeiling}/10</span>
              )}
              {patient.glucoseTarget && (
                <span className="chip">
                  glucose target {patient.glucoseTarget.low}–{patient.glucoseTarget.high}{" "}
                  {patient.glucoseTarget.unit}
                </span>
              )}
              <span className="chip">{patient.email}</span>
            </div>
          </section>

          <section className="panel">
            <h2>Patient reply</h2>
            <p className="hint">
              In production this arrives as an email through AgentMail. The webhook and this box
              call the same <code>submitReply</code> action, so the triage path is identical.
              Try <em>my blood pressure this morning was one eighty six over one oh four</em>.
            </p>
            <form onSubmit={send}>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                placeholder="e.g. did two of the three sets and the pain was about eight by the end"
              />
              <div className="row">
                <button type="submit" disabled={sending || !reply.trim()}>
                  {sending ? "Triaging…" : "Send as patient"}
                </button>
                {error && <span className="error">{error}</span>}
              </div>
            </form>
          </section>
        </>
      )}

      <section className="panel">
        <h2>Check-ins</h2>
        {board === undefined && <p className="hint">Loading…</p>}
        {board?.length === 0 && <p className="hint">No check-ins yet.</p>}
        <ul className="board">
          {board?.map((c) => (
            <li key={c._id} className={`card ${c.level.toLowerCase()} ${c.acknowledged ? "done" : ""}`}>
              <div className="cardhead">
                <span className={`pill ${c.level.toLowerCase()}`}>{LEVEL_LABEL[c.level]}</span>
                <span className="who">
                  {c.patientName}
                  {c.itemTitle ? ` · ${c.itemTitle}` : " · unmatched reply"}
                </span>
                <span className="when">{timeAgo(c.receivedAt)}</span>
              </div>

              <blockquote>{c.rawText}</blockquote>

              <div className="chips">
                <span className="chip">{SOURCE_LABEL[c.extractionSource ?? "parser"]}</span>
                <span className="chip">
                  {c.channel === "email" ? "arrived by email" : "typed on the board"}
                </span>
                {c.keywordHits.length > 0 && (
                  <span className="chip danger">raw-text flag: {c.keywordHits.join(", ")}</span>
                )}
              </div>

              <ul className="reasons">
                {c.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>

              <details className="sent">
                <summary>What was sent back</summary>
                <p>{c.level === "RED" ? AUTO_REPLIES.redFlag : AUTO_REPLIES.acknowledgement}</p>
                <span className="hint">
                  One of exactly two fixed strings. Never generated, chosen by the level code decided.
                </span>
              </details>

              {!c.acknowledged && (
                <button
                  className="ghost small"
                  onClick={() => void acknowledge({ checkinId: c._id as Id<"checkins"> })}
                >
                  Acknowledge
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {patient && <Items patientId={patient._id} />}

      <section className="panel">
        <h2>Escalation thresholds</h2>
        <p className="hint">
          Defined per unit, never converted at read time. Glucose and temperature each get two
          rows on purpose: a table written in Fahrenheit silently ignores a reported fever of 39C,
          and that is a miss. Every row below is asserted against the live engine in
          <code>convex/thresholds.test.ts</code>.
        </p>
        <table className="thresholds">
          <thead>
            <tr><th>Vital</th><th>Unit</th><th>Contact now</th><th>Review today</th></tr>
          </thead>
          <tbody>
            {THRESHOLDS.map((t, i) => (
              <tr key={i}>
                <td>{t.vital}</td>
                <td><code>{t.unit}</code></td>
                <td className="red">{t.red}</td>
                <td className="amber">{t.amber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Items({ patientId }: { patientId: Id<"patients"> }) {
  const items = useQuery(api.items.listForPatient, { patientId });
  const approve = useMutation(api.items.approve);
  const issue = useAction(api.email.issueAndSend);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function tryIssue(itemId: Id<"items">) {
    setError(null);
    setSent(null);
    try {
      const r = await issue({ itemId });
      setSent(r.sent ? "Emailed to the patient." : `Issued, but the send failed: ${r.detail ?? "unknown"}`);
    } catch (err) {
      // The gate lives in the mutation, so this is the real refusal.
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="panel">
      <h2>Home items</h2>
      <p className="hint">
        Nothing reaches a patient until a clinician approves it, and the gate is inside the
        mutation rather than the button. Press <em>Try to send unapproved</em> to see the refusal.
      </p>
      {error && <p className="error">{error}</p>}
      {sent && <p className="ok">{sent}</p>}
      <ul className="items">
        {items?.map((i) => (
          <li key={i._id}>
            <div className="itemmain">
              <strong>{i.title}</strong>
              <span className={`tag ${i.status}`}>{i.status}</span>
              <p className="hint">{i.detail}</p>
              {i.sourceUrl && (
                <div className="citation">
                  <a className="source" href={i.sourceUrl} target="_blank" rel="noreferrer">
                    {i.sourceTitle}
                  </a>
                  {i.sourceVerifiedAt ? (
                    <span className="verified">
                      fetched by Firecrawl {new Date(i.sourceVerifiedAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="unverified">source not yet fetched</span>
                  )}
                  {i.sourceExcerpt && <blockquote className="quote">{i.sourceExcerpt}</blockquote>}
                </div>
              )}
            </div>
            <div className="row">
              {i.status === "draft" && (
                <>
                  <button className="ghost small" onClick={() => void approve({ itemId: i._id })}>
                    Approve
                  </button>
                  <button className="ghost small" onClick={() => void tryIssue(i._id)}>
                    Try to send unapproved
                  </button>
                </>
              )}
              {i.status === "approved" && (
                <button className="ghost small" onClick={() => void tryIssue(i._id)}>
                  Send to patient
                </button>
              )}
              {i.status === "issued" && <span className="chip">sent to patient</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
