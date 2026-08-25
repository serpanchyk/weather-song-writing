import {
  validateCreateRunInput,
  type ValidationIssue,
} from "@weather-song-writing/contracts";

export interface Env {
  /** Set as a Worker secret before OpenRouter integration is enabled. */
  readonly OPENROUTER_API_KEY: string;
  /** The GitHub Pages origin allowed to call this API. */
  readonly FRONTEND_ORIGIN?: string;
  /** Bound when D1 run-history storage is provisioned. */
  readonly RUNS_DB: D1Database;
}

type ErrorCode =
  | "invalid_json"
  | "method_not_allowed"
  | "not_found"
  | "not_implemented"
  | "origin_not_allowed"
  | "validation_error";

interface ErrorResponse {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly issues?: readonly ValidationIssue[];
  };
}

const API_PREFIX = "/api/v1";
const LOCAL_FRONTEND_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export async function handleRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin !== null && !isAllowedOrigin(origin, env)) {
    return errorResponse(
      request,
      env,
      403,
      "origin_not_allowed",
      "This origin is not allowed to call the API.",
      false,
    );
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, env),
    });
  }

  const url = new URL(request.url);
  if (url.pathname === `${API_PREFIX}/health`) {
    return request.method === "GET"
      ? jsonResponse(request, env, {
          status: "ok",
          service: "weather-song-writing-api",
        })
      : methodNotAllowed(request, env, ["GET", "OPTIONS"]);
  }

  if (url.pathname === `${API_PREFIX}/models`) {
    return request.method === "GET"
      ? notImplemented(request, env)
      : methodNotAllowed(request, env, ["GET", "OPTIONS"]);
  }

  if (url.pathname === `${API_PREFIX}/runs`) {
    if (request.method === "GET") {
      return notImplemented(request, env);
    }
    if (request.method === "POST") {
      return createRunPlaceholder(request, env);
    }
    return methodNotAllowed(request, env, ["GET", "POST", "OPTIONS"]);
  }

  if (url.pathname.startsWith(`${API_PREFIX}/runs/`)) {
    return request.method === "GET"
      ? notImplemented(request, env)
      : methodNotAllowed(request, env, ["GET", "OPTIONS"]);
  }

  return errorResponse(request, env, 404, "not_found", "Route not found.");
}

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>;

async function createRunPlaceholder(
  request: Request,
  env: Env,
): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return errorResponse(
      request,
      env,
      400,
      "invalid_json",
      "Request body must contain valid JSON.",
    );
  }

  const validation = validateCreateRunInput(input);
  if (!validation.ok) {
    return errorResponse(
      request,
      env,
      400,
      "validation_error",
      "Run input validation failed.",
      true,
      validation.issues,
    );
  }

  return notImplemented(request, env);
}

function notImplemented(request: Request, env: Env): Response {
  return errorResponse(
    request,
    env,
    501,
    "not_implemented",
    "This endpoint is not implemented yet.",
  );
}

function methodNotAllowed(
  request: Request,
  env: Env,
  allowedMethods: readonly string[],
): Response {
  const response = errorResponse(
    request,
    env,
    405,
    "method_not_allowed",
    "Method not allowed for this route.",
  );
  response.headers.set("Allow", allowedMethods.join(", "));
  return response;
}

function jsonResponse(
  request: Request,
  env: Env,
  body: unknown,
  status = 200,
): Response {
  return Response.json(body, { status, headers: corsHeaders(request, env) });
}

function errorResponse(
  request: Request,
  env: Env,
  status: number,
  code: ErrorCode,
  message: string,
  includeCors = true,
  issues?: readonly ValidationIssue[],
): Response {
  const body: ErrorResponse = {
    error: { code, message, ...(issues === undefined ? {} : { issues }) },
  };
  return Response.json(body, {
    status,
    headers: includeCors ? corsHeaders(request, env) : undefined,
  });
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  });
  const origin = request.headers.get("Origin");
  if (origin !== null && isAllowedOrigin(origin, env)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function isAllowedOrigin(origin: string, env: Env): boolean {
  return env.FRONTEND_ORIGIN === undefined
    ? LOCAL_FRONTEND_ORIGINS.has(origin)
    : origin === env.FRONTEND_ORIGIN;
}
