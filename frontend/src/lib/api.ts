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
  summary: string | null;
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

export interface InterviewPlan {
  suggested_role?: string;
  suggested_difficulty?: Difficulty;
  recommended_focus_areas?: string[];
  tailored_questions?: string[];
  projects?: Array<{
    name: string;
    challenge: string;
    tech_stack: string[];
    outcomes: string;
  }>;
  experience?: {
    session_arc?: string;
    opening_script?: string;
    pacing_notes?: string;
    follow_up_style?: string;
    camera_presence_tips?: string[];
    round_structure?: string[];
  };
}

export interface ProfileResponse {
  id: string;
  user_id: string;
  phone: string | null;
  location: string | null;
  bio: string | null;
  current_title: string | null;
  years_of_experience: number;
  skills: string[];
  linkedin_url: string | null;
  github_url: string | null;
  interview_plan?: InterviewPlan | null;
  created_at: string;
  updated_at: string;
}

async function authenticatedFetch<T>(
  endpoint: string,
  token: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
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
  return authenticatedFetch<InterviewResponse>("/interviews", token, "POST", payload);
}

export function startInterview(token: string, interviewId: string): Promise<InterviewDetail> {
  return authenticatedFetch<InterviewDetail>(`/interviews/${interviewId}/start`, token, "POST", {});
}

export function getInterview(token: string, interviewId: string): Promise<InterviewDetail> {
  return authenticatedFetch<InterviewDetail>(`/interviews/${interviewId}`, token, "GET");
}

export function submitAnswer(token: string, interviewId: string, answer: string): Promise<AnswerResult> {
  return authenticatedFetch<AnswerResult>(`/interviews/${interviewId}/answers`, token, "POST", { answer });
}

export function listInterviews(token: string): Promise<InterviewResponse[]> {
  return authenticatedFetch<InterviewResponse[]>("/interviews", token, "GET");
}

export function getProfile(token: string): Promise<ProfileResponse> {
  return authenticatedFetch<ProfileResponse>("/profile", token, "GET");
}

export async function loginCandidate(email: string, password: string): Promise<string> {
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!loginResponse.ok) {
    const error = await loginResponse.json().catch(() => null);
    throw new Error(error?.detail || "Invalid email or password");
  }
  const result = await loginResponse.json() as { access_token: string };
  return result.access_token;
}


export function updateProfile(token: string, payload: Partial<ProfileResponse>): Promise<ProfileResponse> {
  return authenticatedFetch<ProfileResponse>("/profile", token, "PUT", payload);
}


export async function uploadResume(token: string, file: File): Promise<ProfileResponse> {
  const formData = new FormData();
  formData.append("file", file);
  
  const res = await fetch(`${API_URL}/profile/resume`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail || `Upload failed: ${res.status}`);
  }
  return res.json() as Promise<ProfileResponse>;
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
