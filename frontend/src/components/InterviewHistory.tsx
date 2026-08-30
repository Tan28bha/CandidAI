import Link from "next/link";
import { InterviewResponse } from "../lib/api";

interface InterviewHistoryProps {
  interviews: InterviewResponse[];
  onNewSessionClick: () => void;
}

export default function InterviewHistory({ interviews, onNewSessionClick }: InterviewHistoryProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur">
      <h2 className="text-xl font-bold mb-4">Mock Interview History</h2>
      
      {interviews.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl">
          <p className="text-slate-500 text-sm">You haven't completed any mock interviews yet.</p>
          <button
            onClick={onNewSessionClick}
            className="mt-4 rounded-xl border border-cyan-400/30 hover:border-cyan-300 px-4 py-2 text-xs text-cyan-300 bg-cyan-400/5 transition"
          >
            Configure your first session
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {interviews.map((session) => {
            const isSessionCompleted = session.status === "COMPLETED";
            return (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {session.interview_type.replace("_", " ")}
                    </span>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold ${
                      session.status === "COMPLETED" 
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-amber-500/10 text-amber-300"
                    }`}>
                      {session.status}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold">
                    {session.target_role} ({session.difficulty})
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {session.duration_minutes} minutes · Created {new Date(session.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-4 self-end sm:self-center">
                  {isSessionCompleted ? (
                    <Link
                      href={`/interview/${session.id}`}
                      className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-xs text-slate-300 hover:border-slate-500 hover:bg-slate-900 transition"
                    >
                      Review transcript & feedback
                    </Link>
                  ) : (
                    <Link
                      href={`/interview/${session.id}`}
                      className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-200 transition"
                    >
                      Resume practice session
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
