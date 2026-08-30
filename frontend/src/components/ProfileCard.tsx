import { FormEvent } from "react";
import { ProfileResponse } from "../lib/api";

interface ProfileCardProps {
  profile: ProfileResponse | null;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  editTitle: string;
  setEditTitle: (val: string) => void;
  editLocation: string;
  setEditLocation: (val: string) => void;
  editExp: number;
  setEditExp: (val: number) => void;
  editBio: string;
  setEditBio: (val: string) => void;
  saving: boolean;
  onSave: (e: FormEvent) => void;
}

export default function ProfileCard({
  profile,
  editing,
  setEditing,
  editTitle,
  setEditTitle,
  editLocation,
  setEditLocation,
  editExp,
  setEditExp,
  editBio,
  setEditBio,
  saving,
  onSave,
}: ProfileCardProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Candidate Profile</h2>
        <button
          onClick={() => setEditing(!editing)}
          className="text-xs text-cyan-300 hover:underline"
        >
          {editing ? "Cancel" : "Edit Details"}
        </button>
      </div>

      {editing ? (
        <form onSubmit={onSave} className="space-y-4">
          <label className="block text-xs text-slate-400">
            Professional Title
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="e.g. Software Engineer II"
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-cyan-300"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Location
            <input
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="e.g. SF, CA or Remote"
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-cyan-300"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Years of Experience
            <input
              type="number"
              value={editExp}
              onChange={(e) => setEditExp(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-cyan-300"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Bio summary
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs outline-none focus:border-cyan-300 resize-none"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-cyan-300 py-2 text-xs font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving changes..." : "Save details"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-200">{profile?.current_title || "No Title Specified"}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {profile?.location ? `${profile.location} · ` : ""}
              {profile?.years_of_experience ? `${profile.years_of_experience} yrs experience` : "Experience not set"}
            </p>
          </div>
          
          {profile?.bio ? (
            <p className="text-xs text-slate-400 leading-relaxed italic">
              "{profile.bio}"
            </p>
          ) : (
            <p className="text-xs text-slate-600 italic">No bio provided. Upload your resume to auto-generate a candidate summary.</p>
          )}

          {profile?.skills && profile.skills.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill, index) => (
                  <span key={index} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-800/80">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
