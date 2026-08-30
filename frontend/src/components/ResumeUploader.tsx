import React from "react";

interface ResumeUploaderProps {
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ResumeUploader({ uploading, onUpload }: ResumeUploaderProps) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-[#0d1a2c]/60 p-6 backdrop-blur">
      <h2 className="text-md font-bold mb-1">Tailor with your Resume</h2>
      <p className="text-xs text-slate-400 leading-relaxed mb-4">
        Upload your resume (PDF or TXT). We will extract chunks and vectorise them so the AI interviewer asks you personalized questions about your past experience.
      </p>

      <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-cyan-300/40 rounded-2xl p-4 text-center cursor-pointer transition bg-slate-950/40">
        <span className="text-2xl text-cyan-300">↑</span>
        <span className="text-xs font-semibold mt-2 text-slate-300">
          {uploading ? "Parsing & Enriching..." : "Upload Resume"}
        </span>
        <span className="text-[10px] text-slate-500 mt-1">PDF or TXT format (max 5MB)</span>
        <input
          type="file"
          accept=".pdf,.txt"
          onChange={onUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>
    </div>
  );
}
