"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { InterviewDetail, submitAnswer, startInterview } from "../../../lib/api";

export default function InterviewRoom({ interviewId }: { interviewId: string }) {
  const [session, setSession] = useState<InterviewDetail | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function openInterview() {
      try {
        const storedToken = localStorage.getItem("interview_access_token");
        if (!storedToken) throw new Error("Your session has expired. Return home to create or sign in to an interview session.");
        setToken(storedToken);
        setSession(await startInterview(storedToken, interviewId));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to open interview.");
      } finally { setLoading(false); }
    }
    void openInterview();
  }, [interviewId]);

  const activeTurn = session?.turns.find((turn) => turn.answer === null);
  const answeredTurns = useMemo(() => session?.turns.filter((turn) => turn.answer !== null) ?? [], [session]);
  const averageScore = useMemo(() => {
    if (!answeredTurns.length) return null;
    return (answeredTurns.reduce((total, turn) => total + (turn.score ?? 0), 0) / answeredTurns.length).toFixed(1);
  }, [answeredTurns]);

  const sendAnswer = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !answer.trim()) return;
    setSending(true); setError(null);
    try {
      const result = await submitAnswer(token, interviewId, answer.trim());
      setSession(result.session);
      setAnswer("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to submit this answer.");
    } finally { setSending(false); }
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#08111f] text-slate-300">Preparing your interview room…</main>;
  if (error && !session) return <main className="grid min-h-screen place-items-center bg-[#08111f] p-6 text-center text-rose-200"><div><p>{error}</p><Link className="mt-5 inline-block text-cyan-300 underline" href="/">Return to setup</Link></div></main>;
  if (!session) return null;

  const isComplete = session.status === "COMPLETED";
  return <main className="min-h-screen bg-[#08111f] text-slate-100">
    <header className="border-b border-slate-800 bg-slate-950/50"><div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5"><Link href="/" className="font-semibold tracking-tight">CandidAI <span className="text-slate-500">Interviewer</span></Link><div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">{session.interview_type.replace("_", " ")} · {session.difficulty}</div></div></header>
    <section className="mx-auto grid max-w-5xl gap-6 px-6 py-10 lg:grid-cols-[1fr_280px]"><div>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Live practice</p><h1 className="mt-3 text-3xl font-semibold">{session.target_role} interview</h1><p className="mt-2 text-sm text-slate-400">Answer naturally. After every response, the interviewer will assess the signal and move to the next probe.</p>
      {error && <p className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
      {isComplete ? <section className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-7"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Session complete</p><h2 className="mt-3 text-2xl font-semibold">Your interview signal is recorded.</h2><p className="mt-3 text-slate-300">You completed {answeredTurns.length} questions with an average response score of <span className="font-semibold text-emerald-300">{averageScore}/5</span>.</p><Link href="/" className="mt-6 inline-block rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950">Practice another format</Link></section> : activeTurn && <><section className="mt-8 rounded-3xl border border-slate-700 bg-slate-900/60 p-7"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Question {activeTurn.turn_number}</p><p className="mt-4 text-xl leading-8 text-slate-100">{activeTurn.question}</p></section><form onSubmit={sendAnswer} className="mt-5 rounded-3xl border border-slate-700 bg-slate-900/40 p-5"><label className="text-sm font-medium text-slate-300">Your response<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={7} placeholder="Explain your approach, decisions, tradeoffs, and result…" className="mt-3 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm leading-6 outline-none placeholder:text-slate-600 focus:border-cyan-300" /></label><div className="mt-3 flex items-center justify-between gap-4"><span className="text-xs text-slate-500">Aim for a concise, specific answer.</span><button disabled={sending || answer.trim().length < 10} className="rounded-xl bg-gradient-to-r from-cyan-300 to-indigo-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{sending ? "Reviewing…" : "Submit answer →"}</button></div></form></>}
    </div><aside className="rounded-3xl border border-slate-700/70 bg-slate-900/40 p-5"><p className="text-sm font-semibold">Interview notes</p><div className="mt-5 space-y-4">{answeredTurns.length === 0 ? <p className="text-sm leading-6 text-slate-500">Your feedback will appear here after your first answer.</p> : answeredTurns.map((turn) => <article key={turn.id} className="border-l-2 border-cyan-300/50 pl-3"><div className="flex items-center justify-between text-xs text-slate-500"><span>Question {turn.turn_number}</span><span className="text-cyan-200">{turn.score}/5</span></div><p className="mt-2 text-xs leading-5 text-slate-300">{turn.feedback}</p></article>)}</div></aside></section>
  </main>;
}
