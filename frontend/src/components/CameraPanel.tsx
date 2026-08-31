"use client";

import { useEffect, useRef, useState } from "react";

interface CameraPanelProps {
  tips?: string[];
}

export default function CameraPanel({ tips }: CameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"requesting" | "live" | "blocked">("requesting");

  useEffect(() => {
    let cancelled = false;

    async function enableCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setStatus("live");
      } catch {
        setStatus("blocked");
      }
    }

    void enableCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <aside className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Camera</p>
        <span className={`h-2 w-2 rounded-full ${status === "live" ? "bg-emerald-400" : status === "blocked" ? "bg-rose-400" : "bg-amber-300 animate-pulse"}`} />
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 aspect-video">
        {status === "blocked" ? (
          <div className="grid h-full place-items-center p-4 text-center text-[11px] leading-5 text-rose-200">
            Camera permission is required for this mock loop. Allow camera access and refresh.
          </div>
        ) : (
          <video ref={videoRef} muted playsInline autoPlay className="h-full w-full object-cover scale-x-[-1]" />
        )}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-400">
        Keep your camera on for the full session. Treat this like an onsite loop.
      </p>
      {tips && tips.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-[11px] text-slate-500">
          {tips.slice(0, 3).map((tip) => (
            <li key={tip}>• {tip}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}
