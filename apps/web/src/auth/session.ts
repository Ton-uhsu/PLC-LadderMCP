const API_STORAGE_KEY = "plc-ladder-api";
const SESSION_STORAGE_KEY = "plc-ladder-token";

export type WebUser = {
  username: string;
  role: "admin";
};

export type WebSessionResponse = {
  token: string;
  expires_at: string;
  user: WebUser;
};

export function normalizeApiUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

export function getSavedApiUrl() {
  return localStorage.getItem(API_STORAGE_KEY) ?? "";
}

export function getSavedSessionToken() {
  return sessionStorage.getItem(SESSION_STORAGE_KEY) ?? "";
}

export function saveWebSession(apiUrl: string, session: WebSessionResponse) {
  localStorage.setItem(API_STORAGE_KEY, normalizeApiUrl(apiUrl));
  sessionStorage.setItem(SESSION_STORAGE_KEY, session.token);
}

export function clearWebSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

async function errorMessage(response: Response) {
  try {
    const body = await response.json() as { error?: string };
    return body.error ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function loginWeb(apiUrl: string, username: string, password: string) {
  const base = normalizeApiUrl(apiUrl);
  const response = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<WebSessionResponse>;
}

export async function verifyWebSession(apiUrl: string, token: string) {
  const base = normalizeApiUrl(apiUrl);
  const response = await fetch(`${base}/auth/session`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<{
    authenticated: true;
    expires_at: string;
    user: WebUser;
  }>;
}
