"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { getInterview, getProfile, InterviewDetail, ProfileResponse, startInterview, submitAnswer } from "../../../lib/api";
import CameraPanel from "../../../components/CameraPanel";
import ResumeInsights from "../../../components/ResumeInsights";

function TypewriterText({ text, speed = 8 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
    if (!text) return;
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(i));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return <span>{displayedText}</span>;
}


const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1/ws";

// Extend window interface for SpeechRecognition
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export default function InterviewRoom({ interviewId }: { interviewId: string }) {
  const [session, setSession] = useState<InterviewDetail | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocket references & streaming states
  const socketRef = useRef<WebSocket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [streamingFeedback, setStreamingFeedback] = useState("");
  const [streamingQuestion, setStreamingQuestion] = useState("");
  const [statusStage, setStatusStage] = useState<string | null>(null);

  // Speech Recognition (STT) state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Load interview details
  useEffect(() => {
    async function openInterview() {
      try {
        const storedToken = localStorage.getItem("interview_access_token");
        if (!storedToken) throw new Error("Your session has expired. Return home to create or sign in.");
        setToken(storedToken);
        const [existingSession, candidateProfile] = await Promise.all([
          getInterview(storedToken, interviewId),
          getProfile(storedToken).catch(() => null),
        ]);
        if (candidateProfile) setProfile(candidateProfile);
        
        const finalSession = existingSession.status === "READY"
          ? await startInterview(storedToken, interviewId)
          : existingSession;
          
        setSession(finalSession);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to open interview.");
      } finally {
        setLoading(false);
      }
    }
    void openInterview();
  }, [interviewId]);

  // Connect WebSocket when session is loaded and is ACTIVE
  useEffect(() => {
    if (!session || session.status !== "ACTIVE" || !token) return;

    const socketUrl = `${WS_BASE_URL}/interviews/${interviewId}?token=${token}`;
    const ws = new WebSocket(socketUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setSocketConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "connected":
          setSocketConnected(true);
          break;
        case "status":
          setStatusStage(data.stage);
          break;
        case "feedback_delta":
          setStatusStage("evaluating");
          setStreamingFeedback((prev) => prev + data.text);
          break;
        case "question_delta":
          setStatusStage("generating_question");
          setStreamingQuestion((prev) => prev + data.text);
          break;
        case "evaluation":
          // Score and static feedback are delivered in delta/final, we update temporarily
          break;
        case "complete":
          // The turn processing completed, server returned refreshed session
          setSession(data.session);
          setStreamingFeedback("");
          setStreamingQuestion("");
          setStatusStage(null);
          setSending(false);
          break;
        case "error":
          setError(data.message);
          setSending(false);
          break;
        default:
          break;
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection failed. Falling back to static connection.");
      setSocketConnected(false);
    };

    ws.onclose = () => {
      setSocketConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [session?.status, token, interviewId]);

  // Speech recognition initialization
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[e.resultIndex][0].transcript;
      setAnswer((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.error("Speech Recognition Error: ", e.error);
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Try Google Chrome.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const answeredTurns = useMemo(() => session?.turns.filter((turn) => turn.answer !== null) ?? [], [session]);
  const averageScore = useMemo(() => {
    if (!answeredTurns.length) return null;
    return (answeredTurns.reduce((total, turn) => total + (turn.score ?? 0), 0) / answeredTurns.length).toFixed(1);
  }, [answeredTurns]);

  const activeTurn = session?.turns.find((turn) => turn.answer === null);

  const sendAnswer = (event: FormEvent) => {
    event.preventDefault();
    if (!answer.trim() || sending) return;

    // Stop voice recording if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setSending(true);
    setError(null);

    if (socketConnected && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "submit_answer",
          answer: answer.trim(),
        })
      );
      setAnswer("");
    } else if (token) {
      void (async () => {
        try {
          const result = await submitAnswer(token, interviewId, answer.trim());
          setSession(result.session);
          setAnswer("");
        } catch (requestError) {
          setError(requestError instanceof Error ? requestError.message : "Unable to submit this answer.");
        } finally {
          setSending(false);
        }
      })();
    } else {
      setError("Not connected to live interview server. Please refresh.");
      setSending(false);
    }
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#08111f] text-slate-300">Preparing your interview room…</main>;
  if (error && !session) return <main className="grid min-h-screen place-items-center bg-[#08111f] p-6 text-center text-rose-200"><div><p>{error}</p><Link className="mt-5 inline-block text-cyan-300 underline" href="/dashboard">Return to Dashboard</Link></div></main>;
  if (!session) return null;

  const isComplete = session.status === "COMPLETED";

  return (
    <main className="min-h-screen bg-[#08111f] text-slate-100 selection:bg-cyan-300/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/dashboard" className="font-semibold tracking-tight text-slate-300 hover:text-white transition">
            ← Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full ${socketConnected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
            <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200 uppercase">
              {session.interview_type.replace("_", " ")} · {session.difficulty}
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[260px_1fr_300px]">
        <div className="space-y-4">
          <CameraPanel tips={profile?.interview_plan?.experience?.camera_presence_tips} />
          {profile?.interview_plan?.experience?.opening_script && !isComplete && (
            <p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-[11px] leading-5 text-cyan-100">
              {profile.interview_plan.experience.opening_script}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Live practice room</p>
          <h1 className="mt-2 text-2xl font-bold">{session.target_role} Interview</h1>
          
          {error && <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-200">{error}</p>}
          
          {isComplete ? (
            <section className="mt-6 rounded-3xl border border-emerald-400/20 bg-[#0d2218] p-6 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Session Complete</p>
              <h2 className="mt-2 text-xl font-bold">Your interview signal is recorded.</h2>
              <p className="mt-2 text-sm text-slate-300 leading-6">
                You completed {answeredTurns.length} questions with an average score of <span className="font-bold text-emerald-300">{averageScore}/5</span>.
              </p>
              {session.summary && (
                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Your AI Debrief Summary</p>
                  <p className="mt-3 whitespace-pre-line text-xs leading-6 text-slate-300">
                    <TypewriterText text={session.summary} />
                  </p>
                </div>
              )}

              <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-gradient-to-r from-cyan-300 to-indigo-400 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:brightness-110 transition">
                Return to Dashboard
              </Link>
            </section>
          ) : activeTurn ? (
            <>
              {/* Question display */}
              <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Question {activeTurn.turn_number}</p>
                
                {sending && statusStage === "generating_question" ? (
                  <p className="mt-3 text-lg leading-7 text-cyan-200">
                    {streamingQuestion || "Preparing next question..."}
                    <span className="inline-block h-4 w-1 bg-cyan-300 ml-1 animate-pulse" />
                  </p>
                ) : (
                  <p className="mt-3 text-lg leading-7 text-slate-100">{activeTurn.question}</p>
                )}
              </section>

              {/* Streaming feedback panel (visible while next question loads) */}
              {sending && (streamingFeedback || statusStage === "evaluating") && (
                <section className="mt-4 rounded-3xl border border-indigo-400/20 bg-indigo-950/20 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">
                    {statusStage === "evaluating" ? "Analyzing your answer..." : "Evaluation Complete"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-indigo-200 italic">
                    {streamingFeedback || "Interviewer is assessing code structures and logic depth..."}
                    {statusStage === "evaluating" && <span className="inline-block h-3 w-1 bg-indigo-400 ml-1 animate-pulse" />}
                  </p>
                </section>
              )}

              {/* Response submission form */}
              <form onSubmit={sendAnswer} className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/25 p-5">
                <label className="block text-xs font-medium text-slate-400">
                  Your Response
                  <textarea
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    rows={6}
                    disabled={sending}
                    placeholder="Provide your thought process, implementation decisions, and tradeoffs..."
                    className="mt-2.5 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-6 outline-none placeholder:text-slate-700 focus:border-cyan-300"
                  />
                </label>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {/* Microphone voice integration */}
                    <button
                      type="button"
                      onClick={toggleListening}
                      disabled={sending}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                        isListening 
                          ? "border-rose-500 bg-rose-500/10 text-rose-400 animate-pulse" 
                          : "border-slate-800 bg-slate-950 hover:border-slate-600 text-slate-400"
                      }`}
                      title={isListening ? "Stop listening" : "Start speaking response"}
                    >
                      🎙️
                    </button>
                    <span className="text-[10px] text-slate-500 hidden sm:inline">
                      {isListening ? "Listening... Speak naturally." : "Click microphone to dictate response."}
                    </span>
                  </div>
                  <button
                    disabled={sending || answer.trim().length < 5}
                    className="rounded-xl bg-gradient-to-r from-cyan-300 to-indigo-400 px-5 py-2.5 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 transition"
                  >
                    {sending ? "Analyzing turn..." : "Submit response →"}
                  </button>
                </div>
              </form>
            </>
          ) : null}
        </div>

        {/* Sidebar Notes & History */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur h-fit">
          <h2 className="text-sm font-bold text-slate-300">Question Reviews</h2>
          <div className="mt-4 space-y-4 max-h-[480px] overflow-y-auto pr-1">
            {answeredTurns.length === 0 ? (
              <p className="text-xs leading-5 text-slate-500 italic">
                Each completed turn's scores and feedback will compile here as you advance.
              </p>
            ) : (
              answeredTurns.map((turn) => (
                <article key={turn.id} className="border-l-2 border-cyan-400/40 pl-3">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Turn {turn.turn_number}</span>
                    <span className="rounded bg-cyan-300/10 px-1.5 py-0.5 text-cyan-300 font-semibold">{turn.score}/5</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
                    <TypewriterText text={turn.feedback ?? ""} />
                  </p>
                </article>
              ))

            )}
          </div>
          </div>
          <ResumeInsights profile={profile} />
        </aside>
      </section>
    </main>
  );
}
