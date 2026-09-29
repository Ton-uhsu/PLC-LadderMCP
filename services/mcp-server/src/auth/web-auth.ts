import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type WebSession = {
  sub: string;
  role: "admin";
  type: "web";
  iat: number;
  exp: number;
};

export type WebAuth = ReturnType<typeof createWebAuth>;

function safeTextEqual(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeSignatureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createWebAuth(options: {
  username?: string;
  password?: string;
  secret?: string;
  ttlSeconds?: number;
} = {}) {
  const username = options.username ?? process.env.PLC_LADDER_WEB_USERNAME?.trim() ?? "";
  const password = options.password ?? process.env.PLC_LADDER_WEB_PASSWORD ?? "";
  const envSecret = process.env.PLC_LADDER_WEB_SESSION_SECRET?.trim() ?? "";
  const configuredSecret = options.secret ?? envSecret;
  const generatedSecret = Boolean(username && password && !configuredSecret);
  const secret = configuredSecret || (username && password ? randomBytes(32).toString("base64url") : "");
  const ttlSeconds = Math.max(300, options.ttlSeconds ?? Number(process.env.PLC_LADDER_WEB_SESSION_TTL_SECONDS ?? 28_800));
  const enabled = Boolean(username && password && secret);

  function authenticate(candidateUsername: string, candidatePassword: string) {
    if (!enabled) return false;
    return safeTextEqual(candidateUsername, username) && safeTextEqual(candidatePassword, password);
  }

  function issueSession() {
    if (!enabled) throw new Error("Web authentication is not configured.");
    const now = Math.floor(Date.now() / 1000);
    const payload: WebSession = {
      sub: username,
      role: "admin",
      type: "web",
      iat: now,
      exp: now + ttlSeconds,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encoded}.${sign(encoded, secret)}`;
  }

  function verifySession(token: string): WebSession | null {
    if (!enabled || !token) return null;
    const [encoded, signature, extra] = token.split(".");
    if (!encoded || !signature || extra) return null;
    if (!safeSignatureEqual(signature, sign(encoded, secret))) return null;

    try {
      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as WebSession;
      const now = Math.floor(Date.now() / 1000);
      if (payload.type !== "web" || payload.role !== "admin" || payload.sub !== username) return null;
      if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp) || payload.exp <= now) return null;
      return payload;
    } catch {
      return null;
    }
  }

  return {
    enabled,
    generatedSecret,
    username,
    ttlSeconds,
    authenticate,
    issueSession,
    verifySession,
  };
}
