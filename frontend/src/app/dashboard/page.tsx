"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, FormEvent } from "react";
import {
  getProfile,
  listInterviews,
  updateProfile,
  uploadResume,
  createInterview,
  ProfileResponse,
  InterviewResponse,
  InterviewType,
  Difficulty
} from "../../lib/api";

import ProfileCard from "../../components/ProfileCard";
import ResumeUploader from "../../components/ResumeUploader";
import InterviewHistory from "../../components/InterviewHistory";
import ResumeInsights from "../../components/ResumeInsights";

const interviewTypes: { value: InterviewType; title: string; description: string; icon: string }[] = [
  { value: "technical", title: "Technical", description: "Practical engineering depth", icon: "</>" },
  { value: "dsa", title: "DSA", description: "Algorithms & problem solving", icon: "{}" },
  { value: "system_design", title: "System design", description: "Architecture & tradeoffs", icon: "◫" },
  { value: "behavioral", title: "Behavioral", description: "Leadership & communication", icon: "✦" },
];

const focusOptions = [
  "React",
  "Python",
  "Databases",
  "APIs",
  "Leadership",
  "Distributed systems",
  "TypeScript",
  "Next.js",
  "PostgreSQL",
  "Docker",
];

export default function Dashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [interviews, setInterviews] = useState<InterviewResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile Edit State
  const [editingProfile, setEditingProfile] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editExp, setEditExp] = useState(0);
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  // Resume Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // New Interview Session Form State
  const [showConfig, setShowConfig] = useState(false);
  const [mode, setMode] = useState<InterviewType>("technical");
  const [difficulty, setDifficulty] = useState<Difficulty>("mid");
  const [role, setRole] = useState("Software Engineer");
  const [duration, setDuration] = useState(45);
  const [focus, setFocus] = useState<string[]>(["React", "APIs"]);
  const [creatingSession, setCreatingSession] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("interview_access_token");
    if (!storedToken) {
      router.push("/");
      return;
    }
    const activeToken = storedToken;
    setToken(activeToken);

    async function loadData() {
      try {
        const [profData, intData] = await Promise.all([
          getProfile(activeToken),
          listInterviews(activeToken)
        ]);

        setProfile(profData);
        setInterviews(intData);
        
        // Pre-populate edit fields
        setEditTitle(profData.current_title || "");
        setEditBio(profData.bio || "");
        setEditLocation(profData.location || "");
        setEditExp(profData.years_of_experience || 0);
        setEditSkills(profData.skills || []);
        if (profData.interview_plan?.suggested_role) {
          setRole(profData.interview_plan.suggested_role);
        }
        if (profData.interview_plan?.suggested_difficulty) {
          setDifficulty(profData.interview_plan.suggested_difficulty);
        }
        if (profData.interview_plan?.recommended_focus_areas?.length) {
          setFocus(profData.interview_plan.recommended_focus_areas.slice(0, 4));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [router]);

  const toggleFocus = (area: string) => {
    setFocus((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area]
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("interview_access_token");
    router.push("/");
  };

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingProfile(true);
    try {
      const updated = await updateProfile(token, {
        current_title: editTitle,
        bio: editBio,
        location: editLocation,
        years_of_experience: editExp,
        skills: editSkills
      });
      setProfile(updated);
      setEditingProfile(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    setError(null);
    setUploadSuccess(null);
    try {
      const updatedProfile = await uploadResume(token, file);
      setProfile(updatedProfile);
      
      // Update form fields
      setEditTitle(updatedProfile.current_title || "");
      setEditBio(updatedProfile.bio || "");
      setEditLocation(updatedProfile.location || "");
      setEditExp(updatedProfile.years_of_experience || 0);
      setEditSkills(updatedProfile.skills || []);
      
      if (updatedProfile.interview_plan?.suggested_role) {
        setRole(updatedProfile.interview_plan.suggested_role);
      }
      if (updatedProfile.interview_plan?.suggested_difficulty) {
        setDifficulty(updatedProfile.interview_plan.suggested_difficulty);
      }
      if (updatedProfile.interview_plan?.recommended_focus_areas?.length) {
        setFocus(updatedProfile.interview_plan.recommended_focus_areas.slice(0, 4));
      }

      setUploadSuccess("Resume uploaded successfully! Profile auto-enriched by AI.");
      const intData = await listInterviews(token);
      setInterviews(intData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreatingSession(true);
    setError(null);
    try {
      const interview = await createInterview(token, {
        interview_type: mode,
        target_role: role,
        difficulty,
        duration_minutes: duration,
        focus_areas: focus
      });
      router.push(`/interview/${interview.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create interview session.");
    } finally {
      setCreatingSession(false);
    }
  };

  // Calculate statistics
  const completedInterviews = interviews.filter((i) => i.status === "COMPLETED");
  const activeInterviews = interviews.filter((i) => i.status === "ACTIVE" || i.status === "READY");
  
  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#08111f] text-slate-300">
        Loading your Candidate Dashboard...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08111f] text-slate-100 selection:bg-cyan-300/30">
      {/* Background gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-indigo-600/15 blur-[140px]" />
      </div>

      {/* Header */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6 border-b border-slate-800 bg-slate-950/20 backdrop-blur">
        <div className="flex items-center gap-3 font-semibold tracking-tight">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-indigo-500 text-lg text-slate-950 shadow-lg shadow-cyan-500/20">
            A
          </div>
          <Link href="/dashboard" className="text-xl font-bold tracking-tight">
            CandidAI <span className="text-slate-400 font-normal text-sm">Dashboard</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="rounded-xl bg-gradient-to-r from-cyan-300 to-indigo-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:brightness-110 transition"
          >
            {showConfig ? "Close Creator" : "New Practice Session"}
          </button>
          <button
            onClick={handleLogout}
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-xs text-slate-400 hover:border-slate-500 transition"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}
        {uploadSuccess && (
          <div className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
            {uploadSuccess}
          </div>
        )}

        {/* Create new session overlay/collapsible */}
        {showConfig && (
          <div className="mb-8 rounded-3xl border border-cyan-400/30 bg-slate-900/80 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h2 className="text-xl font-bold text-cyan-300">Set Up a Mock Interview</h2>
              <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateSession} className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-300">Interview format</label>
                <div className="grid gap-3 grid-cols-2">
                  {interviewTypes.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setMode(item.value)}
                      className={`rounded-2xl border p-3 text-left transition ${
                        mode === item.value
                          ? "border-cyan-300 bg-cyan-300/10"
                          : "border-slate-700 bg-slate-950/30 hover:border-slate-500"
                      }`}
                    >
                      <span className="text-lg text-cyan-300">{item.icon}</span>
                      <p className="mt-1 font-medium text-sm">{item.title}</p>
                      <p className="text-[10px] text-slate-500 line-clamp-1">{item.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 grid-cols-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Target role
                    <input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-300"
                    />
                  </label>
                  <div>
                    <p className="text-sm font-medium text-slate-300">Level</p>
                    <div className="mt-2 grid grid-cols-3 rounded-xl bg-slate-950 p-1 border border-slate-800">
                      {(["junior", "mid", "senior"] as Difficulty[]).map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setDifficulty(item)}
                          className={`rounded-lg py-1.5 text-xs capitalize ${
                            difficulty === item ? "bg-slate-700 text-white" : "text-slate-500"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <label className="font-medium text-slate-300">Session length</label>
                    <span className="text-cyan-300">{duration} min</span>
                  </div>
                  <input
                    aria-label="Session length"
                    type="range"
                    min="15"
                    max="90"
                    step="15"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="mt-3 w-full accent-cyan-300"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300">Focus areas (optional)</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from(new Set([...focusOptions, ...(profile?.interview_plan?.recommended_focus_areas || []), ...focus])).map((area) => (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleFocus(area)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          focus.includes(area)
                            ? "border-cyan-300 bg-cyan-300/10 text-cyan-200"
                            : "border-slate-700 text-slate-400"
                        }`}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={creatingSession}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-300 to-indigo-400 py-2.5 font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
                >
                  {creatingSession ? "Creating mock session..." : "Launch Interview Room →"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
          {/* Main Panel: History & Analytics */}
          <div className="space-y-8">
            {/* Quick aggregate statistics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-center">
                <p className="text-slate-400 text-xs uppercase tracking-wider">Completed</p>
                <p className="mt-2 text-3xl font-extrabold text-cyan-300">{completedInterviews.length}</p>
                <p className="text-[10px] text-slate-500 mt-1">sessions done</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-center">
                <p className="text-slate-400 text-xs uppercase tracking-wider">In Progress</p>
                <p className="mt-2 text-3xl font-extrabold text-amber-300">{activeInterviews.length}</p>
                <p className="text-[10px] text-slate-500 mt-1">active sessions</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-center">
                <p className="text-slate-400 text-xs uppercase tracking-wider">Resume Chunks</p>
                <p className="mt-2 text-3xl font-extrabold text-indigo-300">
                  {profile?.skills && profile.skills.length > 0 ? "Vectorized" : "None"}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">tailored context</p>
              </div>
            </div>

            {/* Past Sessions List (Extracted Component) */}
            <InterviewHistory
              interviews={interviews}
              onNewSessionClick={() => setShowConfig(true)}
            />
          </div>

          {/* Sidebar: Profile & Resume upload */}
          <div className="space-y-6">
            {/* Candidate Profile Details (Extracted Component) */}
            <ProfileCard
              profile={profile}
              editing={editingProfile}
              setEditing={setEditingProfile}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              editLocation={editLocation}
              setEditLocation={setEditLocation}
              editExp={editExp}
              setEditExp={setEditExp}
              editBio={editBio}
              setEditBio={setEditBio}
              saving={savingProfile}
              onSave={handleProfileSave}
            />

            {/* Vector Resume Uploader (Extracted Component) */}
            <ResumeUploader
              uploading={uploading}
              onUpload={handleResumeUpload}
            />
            <ResumeInsights profile={profile} />
          </div>
        </div>
      </section>
    </main>
  );
}
