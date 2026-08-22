"use client";

import React, { useState, useEffect } from "react";
import { getApiHealth, getDbHealth, getRedisHealth, HealthResponse } from "../lib/api";

type ConnectionStatus = "checking" | "connected" | "failed";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<ConnectionStatus>("checking");
  const [dbStatus, setDbStatus] = useState<ConnectionStatus>("checking");
  const [redisStatus, setRedisStatus] = useState<ConnectionStatus>("checking");

  const [apiDetails, setApiDetails] = useState<HealthResponse | null>(null);
  const [dbDetails, setDbDetails] = useState<HealthResponse | null>(null);
  const [redisDetails, setRedisDetails] = useState<HealthResponse | null>(null);

  const checkConnections = async () => {
    setApiStatus("checking");
    setDbStatus("checking");
    setRedisStatus("checking");

    try {
      const apiRes = await getApiHealth();
      setApiStatus("connected");
      setApiDetails(apiRes);
    } catch (err) {
      setApiStatus("failed");
      setApiDetails(null);
    }

    try {
      const dbRes = await getDbHealth();
      setDbStatus("connected");
      setDbDetails(dbRes);
    } catch (err) {
      setDbStatus("failed");
      setDbDetails(null);
    }

    try {
      const redisRes = await getRedisHealth();
      setRedisStatus("connected");
      setRedisDetails(redisRes);
    } catch (err) {
      setRedisStatus("failed");
      setRedisDetails(null);
    }
  };

  useEffect(() => {
    checkConnections();
  }, []);

  const getStatusBadge = (status: ConnectionStatus) => {
    switch (status) {
      case "checking":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            Checking
          </span>
        );
      case "connected":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-400"></span>
            Connected
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-400/10 text-rose-400 border border-rose-400/20">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-rose-400"></span>
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-indigo-900/15 blur-[120px]" />
        <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-purple-900/10 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              A
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-350 bg-clip-text text-transparent">
              Antigravity Interviewer
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              API Reference
            </a>
            <button
              onClick={checkConnections}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 transition duration-200 shadow-md shadow-indigo-600/20"
            >
              Recheck System
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex-1 max-w-7xl mx-auto px-6 py-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        
        {/* Intro Info */}
        <section className="lg:col-span-7 flex flex-col space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 w-fit">
            <span className="text-xs font-semibold uppercase tracking-wider">Phase 1 Setup Active</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight lg:leading-none">
            Simulate Realistic technical <br className="hidden md:inline" />
            Interviews with <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Stateful AI Agents</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-xl">
            Antigravity Interviewer uses an orchestration of supervisor, planner, interviewer, and evaluator agents powered by LangGraph to assess resumes, dynamically adjust difficulties, probe weaknesses, and output full skill analysis.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
              <h3 className="font-semibold text-slate-200 text-sm mb-1">Stateful Graph Flow</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Manages complete context dynamically without simple, context-free chatbot loops.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
              <h3 className="font-semibold text-slate-200 text-sm mb-1">Double Probe Validation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tailors follow-ups on user answers to explore technical boundaries, tradeoffs, and failure modes.
              </p>
            </div>
          </div>
        </section>

        {/* Integration Status Panel */}
        <section className="lg:col-span-5 w-full flex flex-col space-y-4">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-white">System Integration Status</h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Verify communication tunnels between the client, the Python gateway, and database servers.
            </p>

            <div className="space-y-4">
              {/* API Connection */}
              <div className="flex flex-col space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-slate-355">FastAPI Backend</span>
                  {getStatusBadge(apiStatus)}
                </div>
                {apiStatus === "connected" && apiDetails && (
                  <p className="text-xs text-slate-500 font-mono">
                    Project: {apiDetails.project} | v{apiDetails.version}
                  </p>
                )}
                {apiStatus === "failed" && (
                  <p className="text-xs text-rose-400/80 font-mono">
                    Unable to reach host http://localhost:8000
                  </p>
                )}
              </div>

              {/* DB Connection */}
              <div className="flex flex-col space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-slate-355">PostgreSQL (pgvector)</span>
                  {getStatusBadge(dbStatus)}
                </div>
                {dbStatus === "connected" && dbDetails && (
                  <p className="text-xs text-slate-500 font-mono">
                    {dbDetails.message}
                  </p>
                )}
                {dbStatus === "failed" && (
                  <p className="text-xs text-rose-400/80 font-mono">
                    Postgres service offline or host connection failure
                  </p>
                )}
              </div>

              {/* Redis Connection */}
              <div className="flex flex-col space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-slate-355">Redis Cache</span>
                  {getStatusBadge(redisStatus)}
                </div>
                {redisStatus === "connected" && redisDetails && (
                  <p className="text-xs text-slate-500 font-mono">
                    {redisDetails.message}
                  </p>
                )}
                {redisStatus === "failed" && (
                  <p className="text-xs text-rose-400/80 font-mono">
                    Redis service offline or keyval check timeout
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={checkConnections}
              className="mt-6 w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/50 hover:border-slate-650 transition duration-150"
            >
              Force Refetch Status
            </button>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 text-center py-6 text-xs text-slate-500">
        <p>&copy; 2026 Antigravity Multi-Agent AI Interview Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
