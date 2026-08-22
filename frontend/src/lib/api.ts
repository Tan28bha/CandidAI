const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface HealthResponse {
  status: string;
  project?: string;
  version?: string;
  service?: string;
  message?: string;
}

export type InterviewType = "technical" | "dsa" | "system_design" | "behavioral";
export type Difficulty = "junior" | "mid" | "senior";

export interface InterviewCreate {
  interview_type: InterviewType;
  target_role: string;
  difficulty: Difficulty;
  duration_minutes: number;
  focus_areas: string[];
}

export interface InterviewResponse extends InterviewCreate {
  id: string;
  status: string;
  created_at: string;
}

export interface InterviewTurn {
  id: string;
  turn_number: number;
  question: string;
  answer: string | null;
  feedback: string | null;
  score: number | null;
  created_at: string;
}

export interface InterviewDetail extends InterviewResponse {
  turns: InterviewTurn[];
}

export interface AnswerResult {
  session: InterviewDetail;
  next_question: InterviewTurn | null;
}

/**
 * Generic fetch helper with error handling
 */
async function apiFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    cache: 'no-store', // Disable caching for health checks
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.statusText} (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function authenticatedFetch<T>(endpoint: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail || `API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function registerAndLogin(email: string, password: string, fullName: string): Promise<string> {
  const registerResponse = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name: fullName, role: "CANDIDATE" }),
  });
  if (!registerResponse.ok && registerResponse.status !== 409) {
    const error = await registerResponse.json().catch(() => null);
    throw new Error(error?.detail || "Unable to create your account");
  }
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!loginResponse.ok) throw new Error("Unable to sign in with those details");
  const result = await loginResponse.json() as { access_token: string };
  return result.access_token;
}

export function createInterview(token: string, payload: InterviewCreate): Promise<InterviewResponse> {
  return authenticatedFetch<InterviewResponse>("/interviews", token, payload);
}

export function startInterview(token: string, interviewId: string): Promise<InterviewDetail> {
  return authenticatedFetch<InterviewDetail>(`/interviews/${interviewId}/start`, token, {});
}

export function submitAnswer(token: string, interviewId: string, answer: string): Promise<AnswerResult> {
  return authenticatedFetch<AnswerResult>(`/interviews/${interviewId}/answers`, token, { answer });
}

/**
 * Fetch general API health status
 */
export async function getApiHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health');
}

/**
 * Fetch database health status
 */
export async function getDbHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health/db');
}

/**
 * Fetch Redis health status
 */
export async function getRedisHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health/redis');
}
