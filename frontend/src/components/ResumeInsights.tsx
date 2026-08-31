import { InterviewPlan, ProfileResponse } from "../lib/api";

interface ResumeInsightsProps {
  profile: ProfileResponse | null;
}

export default function ResumeInsights({ profile }: ResumeInsightsProps) {
  const plan: InterviewPlan | null = profile?.interview_plan || null;
  const projects = plan?.projects || [];
  const questions = plan?.tailored_questions || [];
  const experience = plan?.experience;

  if (!profile) return null;

  const hasDetails = Boolean(
    profile.bio ||
      (profile.skills && profile.skills.length) ||
      projects.length ||
      questions.length ||
      experience
  );

  if (!hasDetails) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6">
        <h2 className="text-md font-bold">Resume details</h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Upload a resume to extract title, skills, projects, and a custom interview blueprint.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6 space-y-4">
      <div>
        <h2 className="text-md font-bold">Extracted from your resume</h2>
        <p className="mt-1 text-[11px] text-slate-500">
          Review these details so you can speak to them during the interview.
        </p>
      </div>

      {profile.current_title && (
        <p className="text-xs text-slate-300">
          <span className="text-slate-500">Title: </span>
          {profile.current_title}
        </p>
      )}

      {plan?.suggested_role && (
        <p className="text-xs text-slate-300">
          <span className="text-slate-500">Architect-suggested loop: </span>
          {plan.suggested_role} · {plan.suggested_difficulty || "mid"}
        </p>
      )}

      {experience?.session_arc && (
        <p className="text-[11px] leading-5 text-slate-400 italic">{experience.session_arc}</p>
      )}

      {projects.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400">Projects the interviewer can probe</p>
          {projects.slice(0, 3).map((project) => (
            <article key={project.name} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs font-semibold text-slate-200">{project.name}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">{project.challenge}</p>
              {project.outcomes && <p className="mt-1 text-[11px] text-cyan-200/80">{project.outcomes}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {(project.tech_stack || []).map((tech) => (
                  <span key={tech} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {tech}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {questions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">Likely resume-based questions</p>
          <ul className="space-y-2">
            {questions.slice(0, 4).map((question) => (
              <li key={question} className="text-[11px] leading-5 text-slate-400">
                • {question}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
