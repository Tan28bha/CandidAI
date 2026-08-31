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
    <main className="min-h-screen bg-[#06141f] text-[#f4f1ea] selection:bg-[#ffb703]/35 font-sans relative overflow-hidden flex flex-col justify-between">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_12%_-10%,rgba(255,183,3,0.18),transparent_55%),radial-gradient(900px_circle_at_92%_18%,rgba(123,97,255,0.22),transparent_50%),radial-gradient(800px_circle_at_48%_110%,rgba(61,220,151,0.14),transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(244,241,234,0.55) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <header className="relative mx-auto w-full max-w-6xl flex items-center justify-between px-6 py-6 border-b border-[#7b61ff]/20 bg-[#06141f]/75 backdrop-blur">
        <div className="flex items-center gap-3 font-semibold tracking-tight">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#ffb703] to-[#7b61ff] text-lg text-[#06141f] font-bold shadow-lg shadow-[#7b61ff]/30">
            A
          </div>
          <span className="text-xl font-bold tracking-tight text-[#f4f1ea]">CandidAI</span>
          <span className="text-[#3ddc97] text-xs px-2 py-0.5 rounded-full bg-[#3ddc97]/10 border border-[#3ddc97]/30">
            Platform v2.0
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-[#7b61ff]/25 bg-[#0b2230]/85 px-4 py-2 text-xs text-[#8ba3b5]">
          <span className={`h-2.5 w-2.5 rounded-full ${
            apiOnline === true ? "bg-[#3ddc97]" : apiOnline === false ? "bg-[#ff6b6b]" : "animate-pulse bg-[#ffb703]"
          }`} />
          {apiOnline === true ? "API Online" : apiOnline === false ? "API Offline" : "Checking System"}
        </div>
      </header>

      <section className="relative mx-auto w-full max-w-6xl px-6 py-12 flex-grow grid gap-12 lg:grid-cols-[1.2fr_0.8fr] items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#ffb703]">
              Interactive AI Interviewing
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl bg-gradient-to-r from-[#f4f1ea] via-[#ffb703] to-[#9d8cff] bg-clip-text text-transparent">
              Practice Smarter with Adaptive Mock Sessions.
            </h1>
            <p className="text-base leading-relaxed text-[#8ba3b5]">
              CandidAI is an advanced multi-agent interview platform powered by Gemini-2.0 and LangGraph. We replicate actual corporate technical loops, DSA evaluations, system design defense, and behavioral reviews.
            </p>
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-bold text-[#f4f1ea] border-b border-[#7b61ff]/25 pb-2">
              How CandidAI Works:
            </h2>

            <div className="flex gap-4">
              <div className="flex-shrink-0 grid h-8 w-8 place-items-center rounded-lg bg-[#ffb703]/15 text-[#ffb703] border border-[#ffb703]/35 font-bold text-xs">
                1
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#f4f1ea]">Vector-Based Resume Personalization</h3>
                <p className="text-xs text-[#8ba3b5] mt-1">
                  Upload your resume (PDF or TXT). We chunk, vectorize, and store your background details locally. The AI evaluator references these chunks to ask custom, experience-informed questions.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 grid h-8 w-8 place-items-center rounded-lg bg-[#7b61ff]/15 text-[#9d8cff] border border-[#7b61ff]/35 font-bold text-xs">
                2
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#f4f1ea]">Live Voice & Text Streaming Arena</h3>
                <p className="text-xs text-[#8ba3b5] mt-1">
                  Speak or type your responses into the live practice room. Our voice dictation captures your reasoning instantly, and streaming feedback displays live evaluations turn-by-turn.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 grid h-8 w-8 place-items-center rounded-lg bg-[#3ddc97]/12 text-[#3ddc97] border border-[#3ddc97]/30 font-bold text-xs">
                3
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#f4f1ea]">AI Debrief Scorecard</h3>
                <p className="text-xs text-[#8ba3b5] mt-1">
                  Receive turn-by-turn scores, highlighted probe areas for follow-ups, and a comprehensive end-of-session AI summary detailing strengths, growth opportunities, and recommendations.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full flex items-center justify-center">
          <div className="w-full rounded-3xl border border-[#7b61ff]/30 bg-[#0b2230]/88 p-8 shadow-[0_28px_80px_rgba(123,97,255,0.22)] backdrop-blur relative">
            <div className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-[#ffb703] to-transparent" />

            <div className="text-center mb-6">
              <h2 className="text-xl font-extrabold text-[#f4f1ea]">
                Get Started
              </h2>
              <p className="text-[11px] text-[#8ba3b5] mt-1.5 leading-relaxed">
                Sign up to configure custom technical formats or sign in to resume practice.
              </p>
            </div>

            <div className="grid grid-cols-2 bg-[#06141f] p-1.5 rounded-2xl border border-[#7b61ff]/20 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthTab("signup");
                  setError(null);
                  setResult(null);
                }}
                className={`rounded-xl py-2 text-xs font-semibold tracking-wide transition ${
                  authTab === "signup" ? "bg-[#ffb703]/15 text-[#ffb703]" : "text-[#6d8294] hover:text-[#f4f1ea]"
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
                  authTab === "signin" ? "bg-[#ffb703]/15 text-[#ffb703]" : "text-[#6d8294] hover:text-[#f4f1ea]"
                }`}
              >
                Sign In
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authTab === "signup" && (
                <label className="block text-xs font-medium text-[#d7e2ea]">
                  Your Full Name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ada Lovelace"
                    className="mt-2 w-full rounded-xl border border-[#7b61ff]/25 bg-[#06141f]/80 px-3 py-2.5 text-xs outline-none focus:border-[#3ddc97] text-[#f4f1ea] placeholder:text-[#5b7384]"
                  />
                </label>
              )}

              <label className="block text-xs font-medium text-[#d7e2ea]">
                Email Address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-xl border border-[#7b61ff]/25 bg-[#06141f]/80 px-3 py-2.5 text-xs outline-none focus:border-[#3ddc97] text-[#f4f1ea] placeholder:text-[#5b7384]"
                />
              </label>

              <label className="block text-xs font-medium text-[#d7e2ea]">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="mt-2 w-full rounded-xl border border-[#7b61ff]/25 bg-[#06141f]/80 px-3 py-2.5 text-xs outline-none focus:border-[#3ddc97] text-[#f4f1ea] placeholder:text-[#5b7384]"
                />
              </label>

              {error && (
                <div className="rounded-xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 p-3 text-xs text-[#ffb4b4]">
                  {error}
                </div>
              )}
              {result && (
                <div className="rounded-xl border border-[#3ddc97]/25 bg-[#3ddc97]/10 p-3 text-xs text-[#b8f5d9]">
                  {result}
                </div>
              )}

              <button
                disabled={submitting || apiOnline === false}
                className="w-full rounded-xl bg-gradient-to-r from-[#ffb703] via-[#f59e0b] to-[#7b61ff] py-3 text-xs font-semibold text-[#06141f] hover:brightness-110 disabled:opacity-50 transition mt-6"
              >
                {submitting ? "Processing..." : authTab === "signup" ? "Create Account & Get Started" : "Sign In to Dashboard"}
              </button>
            </form>

            <p className="mt-4 text-center text-[10px] text-[#6d8294] leading-normal">
              No calendar commitment or schedule. Fully self-paced mock loops.
            </p>
          </div>
        </div>
      </section>

      <footer className="relative mx-auto w-full max-w-6xl text-center py-6 text-[10px] text-[#6d8294] border-t border-[#7b61ff]/15">
        © {new Date().getFullYear()} CandidAI. All rights reserved. Built with Next.js & Turbopack.
      </footer>
    </main>
  );
}
