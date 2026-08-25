import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest, type Env } from "./index.js";

const env = {
  OPENROUTER_API_KEY: "test-secret",
} as Env;

async function dispatch(path: string, init?: RequestInit): Promise<Response> {
  return handleRequest(
    new Request(`https://api.example.test${path}`, init),
    env,
  );
}

test("serves the versioned health endpoint", async () => {
  const response = await dispatch("/api/v1/health");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "weather-song-writing-api",
  });
});

test("exposes future API routes as structured placeholders", async () => {
  for (const path of ["/api/v1/models", "/api/v1/runs", "/api/v1/runs/run-1"]) {
    const response = await dispatch(path);
    assert.equal(response.status, 501);
    assert.deepEqual(await response.json(), {
      error: {
        code: "not_implemented",
        message: "This endpoint is not implemented yet.",
      },
    });
  }
});

test("returns a structured validation error before the run placeholder", async () => {
  const response = await dispatch("/api/v1/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateModelIds: ["only-one"] }),
  });

  assert.equal(response.status, 400);
  const body = (await response.json()) as {
    error: { code: string; issues: Array<{ field: string }> };
  };
  assert.equal(body.error.code, "validation_error");
  assert.deepEqual(
    body.error.issues.map((issue) => issue.field),
    [
      "location",
      "localDateTime",
      "genre",
      "language",
      "lyricsStructure",
      "mood",
      "candidateModelIds",
    ],
  );
});

test("handles malformed JSON with a structured error", async () => {
  const response = await dispatch("/api/v1/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "invalid_json",
      message: "Request body must contain valid JSON.",
    },
  });
});

test("allows local frontend CORS requests and preflight", async () => {
  const response = await dispatch("/api/v1/runs", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:5173",
  );
  assert.equal(
    response.headers.get("Access-Control-Allow-Methods"),
    "GET, POST, OPTIONS",
  );
});

test("rejects origins outside the configured allow list", async () => {
  const response = await dispatch("/api/v1/health", {
    headers: { Origin: "https://untrusted.example" },
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: {
      code: "origin_not_allowed",
      message: "This origin is not allowed to call the API.",
    },
  });
  assert.equal(response.headers.has("Access-Control-Allow-Origin"), false);
});
