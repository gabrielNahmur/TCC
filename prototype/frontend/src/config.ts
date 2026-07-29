const booleanEnv = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : value.toLowerCase() === "true";

const parsedTtl = Number(import.meta.env.VITE_AUTHORIZATION_TTL_SECONDS ?? "60");

export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, ""),
  demoMode: booleanEnv(import.meta.env.VITE_DEMO_MODE, true),
  allowDemoToggle: booleanEnv(import.meta.env.VITE_ALLOW_DEMO_TOGGLE, true),
  authorizationTtlSeconds:
    Number.isFinite(parsedTtl) && parsedTtl >= 10 && parsedTtl <= 120 ? parsedTtl : 60
};
