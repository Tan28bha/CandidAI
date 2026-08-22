const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface HealthResponse {
  status: string;
  project?: string;
  version?: string;
  service?: string;
  message?: string;
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
