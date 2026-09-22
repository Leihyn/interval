import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const LEVEL_LABEL = {
  RED: "Contact now",
  AMBER: "Review today",
  GREEN: "Logged",
} as const;

function timeAgo(ts: number) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function App() {
  const board = useQuery(api.replies.board);
  const patients = useQuery(api.patients.list);
  const seed = useMutation(api.seed.demo);
  const ingest = useAction(api.replies.submitReply);
  const acknowledge = useMutation(api.replies.acknowledge);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patient = patients?.[0];

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!patient || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      await ingest({ email: patient.email, rawText: reply, channel: "paste" });
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
        </div>
        <button className="ghost" onClick={() => void seed({})}>
          Reset demo patient
        </button>
      </header>

      <p className="notice">
        Synthetic patient records only. This is not a monitoring service and not an emergency
        channel.
      </p>

      {patient === undefined && <p className="lede">Connecting…</p>}
      {patients?.length === 0 && (
        <p className="lede">
          No patients yet. Press <strong>Reset demo patient</strong> to load the demo record.
        </p>
      )}

      {patient && (
        <section className="panel">
          <h2>Patient reply</h2>
          <p className="hint">
            In production this arrives as an email reply through AgentMail. The webhook and this box
            call the same <code>ingestReply</code> mutation, so the triage path is identical.
          </p>
          <form onSubmit={submitReply}>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder="e.g. BP 186/104 today, bit of a headache"
            />
            <div className="row">
              <button type="submit" disabled={sending || !reply.trim()}>
                {sending ? "Triaging…" : `Reply as ${patient.name}`}
              </button>
              {error && <span className="error">{error}</span>}
            </div>
          </form>
        </section>
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
              <ul className="reasons">
                {c.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
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
    </main>
  );
}

function Items({ patientId }: { patientId: Id<"patients"> }) {
  const items = useQuery(api.items.listForPatient, { patientId });
  const approve = useMutation(api.items.approve);
  const issue = useMutation(api.items.issue);
  const [error, setError] = useState<string | null>(null);

  async function tryIssue(itemId: Id<"items">) {
    setError(null);
    try {
      await issue({ itemId });
    } catch (err) {
      // The gate lives in the mutation, so this is the real refusal, not a
      // disabled button.
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="panel">
      <h2>Home items</h2>
      {error && <p className="error">{error}</p>}
      <ul className="items">
        {items?.map((i) => (
          <li key={i._id}>
            <div>
              <strong>{i.title}</strong>
              <span className={`tag ${i.status}`}>{i.status}</span>
              <p className="hint">{i.detail}</p>
              {i.sourceUrl && (
                <a className="source" href={i.sourceUrl} target="_blank" rel="noreferrer">
                  {i.sourceTitle}
                </a>
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
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
