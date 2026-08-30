"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  getApiHealth,
  registerAndLogin,
  loginCandidate
} from "../lib/api";

export default function Home() {
  const router = useRouter();
  
  // Authentication State
  const [authTab, setAuthTab] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("interview_access_token");
    if (token) {
      router.push("/dashboard");
      return;
    }
    getApiHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, [router]);

  const handleAuthSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!email || password.length < 6) {
      setError("Please fill out email and a password of at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (authTab === "signup") {
        if (!name) {
          setError("Please enter your name to register.");
          setSubmitting(false);
          return;
        }
        // Register user and log them in
        const token = await registerAndLogin(email, password, name);
        localStorage.setItem("interview_access_token", token);
        setResult("Account registered! Redirecting to dashboard...");
        window.setTimeout(() => {
          router.push("/dashboard");
        }, 800);
      } else {
        // Just Login to Dashboard
        const token = await loginCandidate(email, password);
        localStorage.setItem("interview_access_token", token);
        setResult("Successfully authenticated. Redirecting to dashboard...");
        window.setTimeout(() => {
          router.push("/dashboard");
        }, 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please verify credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#08111f] text-slate-100 selection:bg-cyan-300/30 font-sans relative overflow-hidden flex flex-col justify-between">
      {/* Glow overlays */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[130px] animate-pulse" />
        <div className="absolute right-[-100px] top-1/4 h-[600px] w-[600px] rounded-full bg-indigo-600/15 blur-[160px]" />
      </div>

      {/* Header */}
      <header className="relative mx-auto w-full max-w-6xl flex items-center justify-between px-6 py-6 border-b border-slate-800/80 bg-slate-950/20 backdrop-blur">
        <div className="flex items-center gap-3 font-semibold tracking-tight">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-indigo-500 text-lg text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
            A
          </div>
          <span className="text-xl font-bold tracking-tight text-white">CandidAI</span>
          <span className="text-slate-500 text-xs px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">Platform v2.0</span>
        </div>
        
        <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 px-4 py-2 text-xs text-slate-400">
          <span className={`h-2.5 w-2.5 rounded-full ${
            apiOnline === true ? "bg-emerald-400" : apiOnline === false ? "bg-rose-400" : "animate-pulse bg-amber-300"
          }`} />
          {apiOnline === true ? "API Online" : apiOnline === false ? "API Offline" : "Checking System"}
        </div>
      </header>

      {/* 2-Column Responsive Layout */}
      <section className="relative mx-auto w-full max-w-6xl px-6 py-12 flex-grow grid gap-12 lg:grid-cols-[1.2fr_0.8fr] items-center">
        {/* Left Column: Details about CandidAI */}
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
              Interactive AI Interviewing
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl text-white bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Practice Smarter with Adaptive Mock Sessions.
            </h1>
            <p className="text-base leading-relaxed text-slate-400">
              CandidAI is an advanced multi-agent interview platform powered by Gemini-2.0 and LangGraph. We replicate actual corporate technical loops, DSA evaluations, system design defense, and behavioral reviews.
            </p>
          </div>

          {/* Interactive Steps */}
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
              How CandidAI Works:
            </h2>
            
            <div className="flex gap-4">
              <div className="flex-shrink-0 grid h-8 w-8 place-items-center rounded-lg bg-cyan-300/10 text-cyan-300 border border-cyan-400/20 font-bold text-xs">
                1
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Vector-Based Resume Personalization</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload your resume (PDF or TXT). We chunk, vectorize, and store your background details locally. The AI evaluator references these chunks to ask custom, experience-informed questions.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 grid h-8 w-8 place-items-center rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-400/20 font-bold text-xs">
                2
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Live Voice & Text Streaming Arena</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Speak or type your responses into the live practice room. Our voice dictation captures your reasoning instantly, and streaming feedback displays live evaluations turn-by-turn.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 grid h-8 w-8 place-items-center rounded-lg bg-purple-500/10 text-purple-300 border border-purple-400/20 font-bold text-xs">
                3
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">AI Debrief Scorecard</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Receive turn-by-turn scores, highlighted probe areas for follow-ups, and a comprehensive end-of-session AI summary detailing strengths, growth opportunities, and recommendations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Centered Auth Card */}
        <div className="w-full flex items-center justify-center">
          <div className="w-full rounded-3xl border border-cyan-400/20 bg-[#0d1a2c]/85 p-8 shadow-2xl backdrop-blur relative">
            
            {/* Logo/Slogan in card */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-extrabold text-white">
                Get Started
              </h2>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Sign up to configure custom technical formats or sign in to resume practice.
              </p>
            </div>

            {/* Header Tabs */}
            <div className="grid grid-cols-2 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthTab("signup");
                  setError(null);
                  setResult(null);
                }}
                className={`rounded-xl py-2 text-xs font-semibold tracking-wide transition ${
                  authTab === "signup" ? "bg-slate-800 text-cyan-300" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab("signin");
                  setError(null);
                  setResult(null);
                }}
                className={`rounded-xl py-2 text-xs font-semibold tracking-wide transition ${
                  authTab === "signin" ? "bg-slate-800 text-cyan-300" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Sign In
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authTab === "signup" && (
                <label className="block text-xs font-medium text-slate-300">
                  Your Full Name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ada Lovelace"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs outline-none focus:border-cyan-300 text-white"
                  />
                </label>
              )}

              <label className="block text-xs font-medium text-slate-300">
                Email Address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs outline-none focus:border-cyan-300 text-white"
                />
              </label>

              <label className="block text-xs font-medium text-slate-300">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs outline-none focus:border-cyan-300 text-white"
                />
              </label>

              {error && (
                <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-200">
                  {error}
                </div>
              )}
              {result && (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-200">
                  {result}
                </div>
              )}

              <button
                disabled={submitting || apiOnline === false}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-300 to-indigo-400 py-3 text-xs font-semibold text-slate-950 hover:brightness-110 disabled:opacity-50 transition mt-6"
              >
                {submitting ? "Processing..." : authTab === "signup" ? "Create Account & Get Started" : "Sign In to Dashboard"}
              </button>
            </form>

            <p className="mt-4 text-center text-[10px] text-slate-500 leading-normal">
              No calendar commitment or schedule. Fully self-paced mock loops.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative mx-auto w-full max-w-6xl text-center py-6 text-[10px] text-slate-500 border-t border-slate-900">
        © {new Date().getFullYear()} CandidAI. All rights reserved. Built with Next.js & Turbopack.
      </footer>
    </main>
  );
}
