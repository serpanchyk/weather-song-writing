import {
  validateCreateRunInput,
  type CreateRunInput,
  type RunHistoryPage,
  type ValidationIssue,
} from "@weather-song-writing/contracts";

import {
  InvalidHistoryCursorError,
  RunHistoryRepository,
} from "./run-history.js";
import { ModelCatalogError, OpenRouterModelCatalog } from "./model-catalog.js";
import { GenerationPipeline, OpenRouterChatClient } from "./generation.js";
import {
  OpenMeteoWeatherResolver,
  WeatherServiceError,
  WeatherValidationError,
} from "./weather.js";

export interface Env {
  /** Set as a Worker secret before OpenRouter integration is enabled. */
  readonly OPENROUTER_API_KEY: string;
  /** The GitHub Pages origin allowed to call this API. */
  readonly FRONTEND_ORIGIN?: string;
  /** Bound when D1 run-history storage is provisioned. */
  readonly RUNS_DB: D1Database;
  /** Test-only override; production uses the Worker global fetch. */
  readonly fetcher?: typeof fetch;
}

type ErrorCode =
  | "invalid_json"
  | "method_not_allowed"
  | "not_found"
  | "not_implemented"
  | "origin_not_allowed"
  | "storage_error"
  | "upstream_error"
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
      ? listModels(request, env, url)
      : methodNotAllowed(request, env, ["GET", "OPTIONS"]);
  }

  if (url.pathname === `${API_PREFIX}/runs`) {
    if (request.method === "GET") {
      return listRuns(request, env, url);
    }
    if (request.method === "POST") return createRun(request, env);
    return methodNotAllowed(request, env, ["GET", "POST", "OPTIONS"]);
  }

  if (url.pathname.startsWith(`${API_PREFIX}/runs/`)) {
    return request.method === "GET"
      ? getRun(request, env, url.pathname.slice(`${API_PREFIX}/runs/`.length))
      : methodNotAllowed(request, env, ["GET", "OPTIONS"]);
  }

  return errorResponse(request, env, 404, "not_found", "Route not found.");
}

async function listModels(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const includeExpensive = url.searchParams.get("includeExpensive") === "true";
  try {
    return jsonResponse(request, env, {
      models: await new OpenRouterModelCatalog(
        env.OPENROUTER_API_KEY,
        env.fetcher,
      ).list({
        search: url.searchParams.get("search") ?? undefined,
        provider: url.searchParams.get("provider") ?? undefined,
        includeExpensive,
      }),
    });
  } catch (error) {
    if (error instanceof ModelCatalogError) {
      return errorResponse(request, env, 502, "upstream_error", error.message);
    }
    throw error;
  }
}

async function listRuns(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const limitValue = url.searchParams.get("limit");
  const limit = limitValue === null ? 20 : Number(limitValue);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return errorResponse(
      request,
      env,
      400,
      "validation_error",
      "limit must be an integer from 1 to 100.",
    );
  }

  try {
    const page: RunHistoryPage = await new RunHistoryRepository(
      env.RUNS_DB,
    ).list(url.searchParams.get("cursor"), limit);
    return jsonResponse(request, env, page);
  } catch (error) {
    return historyErrorResponse(request, env, error);
  }
}

async function getRun(
  request: Request,
  env: Env,
  encodedId: string,
): Promise<Response> {
  let id: string;
  try {
    id = decodeURIComponent(encodedId);
  } catch {
    return errorResponse(request, env, 404, "not_found", "Route not found.");
  }
  if (id.length === 0 || id.includes("/")) {
    return errorResponse(request, env, 404, "not_found", "Route not found.");
  }

  try {
    const run = await new RunHistoryRepository(env.RUNS_DB).getById(id);
    return run === null
      ? errorResponse(request, env, 404, "not_found", "Run not found.")
      : jsonResponse(request, env, run);
  } catch (error) {
    return historyErrorResponse(request, env, error);
  }
}

function historyErrorResponse(
  request: Request,
  env: Env,
  error: unknown,
): Response {
  if (error instanceof InvalidHistoryCursorError) {
    return errorResponse(request, env, 400, "validation_error", error.message);
  }
  console.error(
    JSON.stringify({
      event: "run_history_storage_error",
      error: String(error),
    }),
  );
  return errorResponse(
    request,
    env,
    500,
    "storage_error",
    "Run history is temporarily unavailable.",
  );
}

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>;

async function createRun(request: Request, env: Env): Promise<Response> {
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

  try {
    const pipeline = new GenerationPipeline({
      weather: new OpenMeteoWeatherResolver(env.fetcher),
      catalog: new OpenRouterModelCatalog(env.OPENROUTER_API_KEY, env.fetcher),
      chat: new OpenRouterChatClient(env.OPENROUTER_API_KEY, env.fetcher),
      history: new RunHistoryRepository(env.RUNS_DB),
    });
    if (request.headers.get("Accept")?.includes("text/event-stream"))
      return streamRun(request, env, pipeline, validation.value);
    const run = await pipeline.create(validation.value);
    return jsonResponse(request, env, run, 201);
  } catch (error) {
    if (error instanceof WeatherValidationError) {
      return errorResponse(
        request,
        env,
        400,
        "validation_error",
        error.message,
      );
    }
    if (
      error instanceof WeatherServiceError ||
      error instanceof ModelCatalogError
    ) {
      return errorResponse(request, env, 502, "upstream_error", error.message);
    }
    console.error(
      JSON.stringify({ event: "generation_error", error: String(error) }),
    );
    return errorResponse(
      request,
      env,
      500,
      "storage_error",
      "Generation could not be saved.",
    );
  }
}

function streamRun(
  request: Request,
  env: Env,
  pipeline: GenerationPipeline,
  input: CreateRunInput,
): Response {
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  const send = async (event: string, body: unknown) => {
    await writer.write(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(body)}\n\n`),
    );
  };
  void (async () => {
    try {
      const run = await pipeline.create(
        input,
        (progress) => void send("progress", progress),
      );
      await send("complete", run);
    } catch (error) {
      await send("error", {
        message: error instanceof Error ? error.message : "Generation failed.",
      });
    } finally {
      await writer.close();
    }
  })();
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  return new Response(stream.readable, { status: 201, headers });
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
