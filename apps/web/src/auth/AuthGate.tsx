import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  LogIn,
  LogOut,
  ShieldCheck,
  UserRound,
  Workflow,
} from "lucide-react";
import { useProjectStore } from "../store";
import {
  clearWebSession,
  getConfiguredApiUrl,
  getSavedSessionToken,
  loginWeb,
  saveWebSession,
  verifyWebSession,
  type WebUser,
} from "./session";
import "./auth.css";

function AuthBrand() {
  return <div className="auth-brand">
    <div className="auth-brand-mark"><Workflow size={19}/></div>
    <div><strong>PLC Ladder</strong><span>MCP Studio</span></div>
  </div>;
}

function LadderAccessPreview() {
  return <div className="auth-preview-panel">
    <div className="auth-preview-head">
      <div>
        <span className="auth-kicker">NETWORK 0</span>
        <strong>Human-reviewed control flow</strong>
      </div>
      <div className="auth-preview-badge"><Activity size={12}/> LIVE IR PREVIEW</div>
    </div>
    <div className="auth-preview-canvas">
      <svg viewBox="0 0 620 220" role="img" aria-label="Example PLC ladder network">
        <line x1="48" y1="30" x2="48" y2="190" className="auth-wire auth-rail"/>
        <line x1="572" y1="30" x2="572" y2="190" className="auth-wire auth-rail"/>
        <text x="18" y="104" className="auth-step">0</text>
        <line x1="48" y1="100" x2="168" y2="100" className="auth-wire"/>
        <line x1="168" y1="76" x2="168" y2="124" className="auth-symbol"/>
        <line x1="210" y1="76" x2="210" y2="124" className="auth-symbol"/>
        <text x="189" y="61" textAnchor="middle" className="auth-device">X0</text>
        <line x1="210" y1="100" x2="402" y2="100" className="auth-wire"/>
        <path d="M422 100 C422 76 474 76 474 100 C474 124 422 124 422 100" className="auth-symbol auth-fill-none"/>
        <text x="448" y="61" textAnchor="middle" className="auth-device">Y0</text>
        <line x1="474" y1="100" x2="572" y2="100" className="auth-wire"/>
        <text x="18" y="171" className="auth-step">END</text>
        <line x1="48" y1="166" x2="434" y2="166" className="auth-wire auth-muted-wire"/>
        <text x="452" y="171" className="auth-end">END</text>
        <line x1="494" y1="166" x2="572" y2="166" className="auth-wire auth-muted-wire"/>
      </svg>
    </div>
    <div className="auth-preview-note">
      <CheckCircle2 size={14}/>
      <span>AI proposals stay unapplied until a signed-in human approves them.</span>
    </div>
  </div>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const setApiUrl = useProjectStore(s => s.setApiUrl);
  const setApiToken = useProjectStore(s => s.setApiToken);
  const syncProject = useProjectStore(s => s.syncProject);
  const apiUrl = getConfiguredApiUrl();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<WebUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const savedToken = getSavedSessionToken();
      if (!savedToken) {
        if (!cancelled) setChecking(false);
        return;
      }

      try {
        const session = await verifyWebSession(apiUrl, savedToken);
        if (cancelled) return;
        setApiUrl(apiUrl);
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
  }, [apiUrl, setApiToken, setApiUrl]);

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
      <AuthBrand/>
      <div className="auth-loading-mark"><ShieldCheck size={24}/></div>
      <strong>Checking workspace session</strong>
      <span>Connecting to the PLC Ladder backend…</span>
    </div>;
  }

  if (!user) {
    return <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-showcase">
          <AuthBrand/>
          <div className="auth-showcase-copy">
            <span className="auth-kicker">AI-FIRST LADDER ENGINEERING</span>
            <h1>Review the logic.<br/>Then let it run.</h1>
            <p>One workspace for Ladder IR, validation, AI proposals, human approval, history, and vendor export.</p>
          </div>

          <LadderAccessPreview/>

          <div className="auth-flow">
            <div><Bot size={15}/><span><b>01</b> AI proposes</span></div>
            <i/>
            <div><ShieldCheck size={15}/><span><b>02</b> Human reviews</span></div>
            <i/>
            <div><CheckCircle2 size={15}/><span><b>03</b> IR applies</span></div>
          </div>
        </section>

        <section className="auth-login-panel">
          <form className="auth-card" onSubmit={submit}>
            <div className="auth-login-topline">
              <div className="auth-mark"><LockKeyhole size={20}/></div>
              <div className="auth-access-badge"><span/> HUMAN REVIEW ACCESS</div>
            </div>

            <div className="auth-heading">
              <span className="auth-kicker">SECURE WORKSPACE</span>
              <h2>Sign in to MCP Studio</h2>
              <p>Use your operator account to access projects and approve AI-generated Ladder changes.</p>
            </div>

            <div className="auth-fields">
              <label>
                <span>Username</span>
                <div className="auth-input-wrap"><UserRound size={15}/><input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" placeholder="Operator username" required/></div>
              </label>
              <label>
                <span>Password</span>
                <div className="auth-input-wrap"><KeyRound size={15}/><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••••••" required/></div>
              </label>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button className="auth-submit" type="submit" disabled={submitting}>
              <LogIn size={16}/>{submitting ? "Signing in…" : "Enter workspace"}
            </button>

            <div className="auth-security-note">
              <ShieldCheck size={14}/>
              <span>Web sessions are short-lived. The MCP machine token is never exposed to this browser.</span>
            </div>
          </form>
        </section>
      </div>
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
