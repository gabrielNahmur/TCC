import { config } from "./config";
import { demoAuthorize, demoCompatibility, demoComplete, demoOverride } from "./demo";
import type {
  AuthorizationDecision,
  AuthorizationRequest,
  CompatibilityCheck,
  OverrideRequest
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly outcomeUnknown = false
  ) {
    super(message);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Falha na comunicação (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: unknown; message?: unknown };
      if (typeof body.detail === "string") message = body.detail;
      else if (typeof body.message === "string") message = body.message;
    } catch {
      // Mantém a mensagem segura; respostas HTML não são exibidas ao operador.
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

async function request<T>(
  path: string,
  { method, body, token }: { method: "GET" | "POST"; body?: unknown; token?: string }
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    return await readJson<T>(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Tempo limite excedido antes da confirmação do servidor.", undefined, true);
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError("A conexão foi interrompida antes da confirmação do servidor.", undefined, true);
  } finally {
    window.clearTimeout(timeout);
  }
}

const post = <T,>(path: string, body?: unknown, token?: string) =>
  request<T>(path, { method: "POST", body, token });

const get = <T,>(path: string) => request<T>(path, { method: "GET" });

export const api = {
  checkCompatibility(plate: string, demoMode: boolean) {
    return demoMode
      ? demoCompatibility(plate)
      : post<CompatibilityCheck>("/api/v1/compatibility-checks", { plate });
  },

  authorize(request: AuthorizationRequest, demoMode: boolean) {
    return demoMode
      ? demoAuthorize(request)
      : post<AuthorizationDecision>("/api/v1/authorizations", request);
  },

  override(
    previous: AuthorizationDecision,
    request: OverrideRequest,
    demoMode: boolean
  ) {
    return demoMode
      ? demoOverride(previous, request)
      : post<AuthorizationDecision>(
          `/api/v1/authorizations/${encodeURIComponent(previous.authorization_id)}/override`,
          { supervisor_id: request.supervisor_id, justification: request.justification },
          request.token
        );
  },

  async complete(previous: AuthorizationDecision, actorId: string, demoMode: boolean) {
    if (demoMode) return demoComplete(previous);
    return post<AuthorizationDecision>(
      `/api/v1/authorizations/${encodeURIComponent(previous.authorization_id)}/complete`,
      { actor_id: actorId }
    );
  },

  getAuthorization(authorizationId: string) {
    return get<AuthorizationDecision>(
      `/api/v1/authorizations/${encodeURIComponent(authorizationId)}`
    );
  }
};
