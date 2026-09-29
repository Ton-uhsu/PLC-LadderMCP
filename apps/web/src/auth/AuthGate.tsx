import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { LockKeyhole, LogIn, LogOut, Server, ShieldCheck } from "lucide-react";
import { useProjectStore } from "../store";
import {
  clearWebSession,
  getSavedApiUrl,
  getSavedSessionToken,
  loginWeb,
  saveWebSession,
  verifyWebSession,
  type WebUser,
} from "./session";
import "./auth.css";

export function AuthGate({ children }: { children: ReactNode }) {
  const setApiUrl = useProjectStore(s => s.setApiUrl);
  const setApiToken = useProjectStore(s => s.setApiToken);
  const syncProject = useProjectStore(s => s.syncProject);
  const [apiUrl, setApiUrlInput] = useState(getSavedApiUrl() || "http://localhost:3001");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<WebUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const savedApi = getSavedApiUrl();
      const savedToken = getSavedSessionToken();
      if (!savedApi || !savedToken) {
        if (!cancelled) setChecking(false);
        return;
      }

      try {
        const session = await verifyWebSession(savedApi, savedToken);
        if (cancelled) return;
        setApiUrl(savedApi);
        setApiToken(savedToken);
        await useProjectStore.getState().syncProject();
        if (cancelled) return;
        setUser(session.user);
      } catch {
        clearWebSession();
        setApiToken("");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    restore();
    return () => { cancelled = true; };
  }, [setApiToken, setApiUrl]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const session = await loginWeb(apiUrl, username, password);
      saveWebSession(apiUrl, session);
      setApiUrl(apiUrl);
      setApiToken(session.token);
      await syncProject();
      setUser(session.user);
      setPassword("");
    } catch (cause) {
      clearWebSession();
      setApiToken("");
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    clearWebSession();
    setApiToken("");
    setUser(null);
    setPassword("");
  }

  if (checking) {
    return <div className="auth-page auth-loading">
      <ShieldCheck size={32}/>
      <strong>Checking session</strong>
      <span>Connecting to the PLC Ladder backend…</span>
    </div>;
  }

  if (!user) {
    return <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-mark"><LockKeyhole size={26}/></div>
        <div className="auth-heading">
          <span>PLC LADDER MCP</span>
          <h1>Sign in</h1>
          <p>Human access to projects, AI Changes, approval, and history.</p>
        </div>

        <label>
          <span>Backend URL</span>
          <div className="auth-input-wrap"><Server size={16}/><input value={apiUrl} onChange={e => setApiUrlInput(e.target.value)} required/></div>
        </label>
        <label>
          <span>Username</span>
          <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required/>
        </label>
        <label>
          <span>Password</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required/>
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button className="auth-submit" type="submit" disabled={submitting}>
          <LogIn size={16}/>{submitting ? "Signing in…" : "Sign in"}
        </button>
        <small>The browser receives only a short-lived Web session. The MCP machine token stays server-side / in the AI client.</small>
      </form>
    </div>;
  }

  return <div className="auth-authenticated">
    <div className="auth-session-chip">
      <ShieldCheck size={14}/><span>{user.username}</span>
      <button onClick={logout} title="Sign out"><LogOut size={14}/> Sign out</button>
    </div>
    {children}
  </div>;
}
