import { createContext, useContext } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import type { WebUser } from './session';

export const AuthSessionContext = createContext<{user:WebUser;logout:()=>void} | null>(null);

export function SessionControls() {
  const session = useContext(AuthSessionContext);
  if (!session) return null;
  return <section className="auth-session-controls" aria-label="Signed-in account">
    <div className="auth-session-user"><ShieldCheck size={14}/><span>{session.user.username}</span></div>
    <button onClick={session.logout} aria-label="Sign out" title="Sign out"><LogOut size={14}/><span>Sign out</span></button>
  </section>;
}
