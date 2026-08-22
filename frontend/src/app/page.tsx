"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createInterview, Difficulty, getApiHealth, InterviewType, registerAndLogin } from "../lib/api";

const modes: { value: InterviewType; title: string; description: string; icon: string }[] = [
  { value: "technical", title: "Technical", description: "Practical engineering depth", icon: "</>" },
  { value: "dsa", title: "DSA", description: "Algorithms & problem solving", icon: "{}" },
  { value: "system_design", title: "System design", description: "Architecture & tradeoffs", icon: "◫" },
  { value: "behavioral", title: "Behavioral", description: "Leadership & communication", icon: "✦" },
];
const focusOptions = ["React", "Python", "Databases", "APIs", "Leadership", "Distributed systems"];

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<InterviewType>("technical");
  const [difficulty, setDifficulty] = useState<Difficulty>("mid");
  const [role, setRole] = useState("Software Engineer");
  const [duration, setDuration] = useState(45);
  const [focus, setFocus] = useState<string[]>(["React", "APIs"]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getApiHealth().then(() => setApiOnline(true)).catch(() => setApiOnline(false)); }, []);
  const toggleFocus = (area: string) => setFocus((current) => current.includes(area) ? current.filter((item) => item !== area) : [...current, area]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null); setResult(null);
    if (!name || !email || password.length < 6) { setError("Add your name, email, and a password of at least 6 characters."); return; }
    setSubmitting(true);
    try {
      const token = await registerAndLogin(email, password, name);
      const interview = await createInterview(token, { interview_type: mode, target_role: role, difficulty, duration_minutes: duration, focus_areas: focus });
      localStorage.setItem("interview_access_token", token);
      setResult(`Session ready — opening your ${interview.duration_minutes}-minute practice room…`);
      window.setTimeout(() => { router.push(`/interview/${interview.id}`); }, 500);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Something went wrong. Please try again."); }
    finally { setSubmitting(false); }
  };

  return <main className="min-h-screen bg-[#08111f] text-slate-100 selection:bg-cyan-300/30">
    <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" /><div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-indigo-600/15 blur-[140px]" /></div>
    <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6"><div className="flex items-center gap-3 font-semibold tracking-tight"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-indigo-500 text-lg text-slate-950 shadow-lg shadow-cyan-500/20">A</div><span>CandidAI</span><span className="text-slate-500">Interviewer</span></div><div className="flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400"><span className={`h-2 w-2 rounded-full ${apiOnline === true ? "bg-emerald-400" : apiOnline === false ? "bg-rose-400" : "animate-pulse bg-amber-300"}`} />{apiOnline === true ? "Platform online" : apiOnline === false ? "Platform offline" : "Checking platform"}</div></header>
    <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10"><div className="max-w-3xl"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Practice with intent</p><h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Sit Back & Prep || Multi AI Agent Interview Platform</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-400">Configure a focused mock interview. The agent will adapt to your answers, probe your reasoning, and build a signal-rich practice session around your goals.</p></div>
      <form onSubmit={submit} className="mt-12 grid gap-6 lg:grid-cols-[1.3fr_.7fr]"><section className="rounded-3xl border border-slate-700/60 bg-slate-900/55 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8"><div className="mb-7 flex items-center justify-between"><h2 className="text-xl font-semibold">Build your session</h2><span className="text-sm text-slate-500">01 — Setup</span></div><label className="text-sm font-medium text-slate-300">Interview format</label><div className="mt-3 grid gap-3 sm:grid-cols-2">{modes.map((item) => <button key={item.value} type="button" onClick={() => setMode(item.value)} className={`rounded-2xl border p-4 text-left transition ${mode === item.value ? "border-cyan-300 bg-cyan-300/10" : "border-slate-700 bg-slate-950/30 hover:border-slate-500"}`}><span className="text-lg text-cyan-300">{item.icon}</span><p className="mt-2 font-medium">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.description}</p></button>)}</div>
        <div className="mt-7 grid gap-6 sm:grid-cols-2"><label className="text-sm font-medium text-slate-300">Target role<input value={role} onChange={(event) => setRole(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-cyan-300" /></label><div><p className="text-sm font-medium text-slate-300">Level</p><div className="mt-2 grid grid-cols-3 rounded-xl bg-slate-950 p-1">{(["junior", "mid", "senior"] as Difficulty[]).map((item) => <button key={item} type="button" onClick={() => setDifficulty(item)} className={`rounded-lg py-2 text-xs capitalize ${difficulty === item ? "bg-slate-700 text-white" : "text-slate-500"}`}>{item}</button>)}</div></div></div>
        <div className="mt-7"><div className="flex justify-between text-sm"><label className="font-medium text-slate-300">Session length</label><span className="text-cyan-300">{duration} min</span></div><input aria-label="Session length" type="range" min="15" max="90" step="15" value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-4 w-full accent-cyan-300" /></div><div className="mt-7"><p className="text-sm font-medium text-slate-300">Focus areas <span className="font-normal text-slate-500">(optional)</span></p><div className="mt-3 flex flex-wrap gap-2">{focusOptions.map((area) => <button key={area} type="button" onClick={() => toggleFocus(area)} className={`rounded-full border px-3 py-1.5 text-xs transition ${focus.includes(area) ? "border-cyan-300 bg-cyan-300/10 text-cyan-200" : "border-slate-700 text-slate-400"}`}>{area}</button>)}</div></div></section>
        <aside className="rounded-3xl border border-slate-700/60 bg-[#0d1a2c] p-6 shadow-2xl shadow-black/20 sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">02 — Start</p><h2 className="mt-3 text-2xl font-semibold">Save your practice plan</h2><p className="mt-3 text-sm leading-6 text-slate-400">Create a candidate account to save this session and receive tailored feedback.</p><div className="mt-6 space-y-4"><label className="block text-sm text-slate-300">Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300" /></label><label className="block text-sm text-slate-300">Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300" /></label><label className="block text-sm text-slate-300">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="At least 6 characters" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300" /></label></div>{error && <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}{result && <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{result}</p>}<button disabled={submitting || apiOnline === false} className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-300 to-indigo-400 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Creating your session…" : "Create interview session →"}</button><p className="mt-4 text-center text-xs leading-5 text-slate-500">Your configuration is saved to your candidate profile. No calendar commitment required.</p></aside></form></section>
  </main>;
}
