import assert from "node:assert/strict";
import test from "node:test";
import type {
  CreateRunInput,
  ModelCatalogEntry,
  WeatherSummary,
} from "@weather-song-writing/contracts";

import {
  DEFAULT_JUDGE_MODEL_ID,
  GenerationPipeline,
  type CompletionClient,
} from "./generation.js";

const input: CreateRunInput = {
  location: { kind: "city", city: "Lviv" },
  localDateTime: "2026-08-25T18:30",
  genre: "pop",
  language: "en",
  lyricsStructure: "verse-chorus",
  mood: "joyful",
  candidateModelIds: ["acme/a", "acme/b", "acme/c"],
  judgeModelId: "acme/judge",
};
const weather: WeatherSummary = {
  displayLocation: "Lviv",
  latitude: 49,
  longitude: 24,
  localDateTime: input.localDateTime,
  timezone: "Europe/Kyiv",
  temperatureCelsius: 19,
  apparentTemperatureCelsius: 18,
  precipitationMm: 0,
  windSpeedKph: 10,
  weatherDescription: "Clear sky",
};
const models: ModelCatalogEntry[] = input.candidateModelIds.map((id) => ({
  id,
  displayName: id,
  provider: "acme",
  contextLength: null,
  supportedModalities: ["text"],
  pricing: { promptUsdPerMillionTokens: 1, completionUsdPerMillionTokens: 2 },
  pricingStatus: "available",
}));

test("uses GPT-5.6 Luna Pro as the default judge", () => {
  assert.equal(DEFAULT_JUDGE_MODEL_ID, "openai/gpt-5.6-luna-pro");
});

test("persists and ranks a completed generated run", async () => {
  const saved: unknown[] = [];
  const run = await pipeline(client(), saved).create(input);
  assert.equal(run.status, "completed");
  assert.equal(run.candidateOutputs.length, 3);
  assert.equal(run.judgeEvaluations.length, 3);
  assert.equal(
    run.rankings.filter((item) => item.status === "ranked").length,
    3,
  );
  assert.equal(saved[0], run);
});

test("persists a partial run and excludes a failed candidate from ranking", async () => {
  const saved: unknown[] = [];
  const run = await pipeline(client(new Set(["acme/c"])), saved).create(input);
  assert.equal(run.status, "partial");
  assert.equal(run.successfulOutputCount, 2);
  assert.equal(
    run.candidateOutputs.find((item) => item.modelId === "acme/c")!.status,
    "failed",
  );
  assert.equal(run.rankings.length, 2);
  assert.equal(saved[0], run);
});

test("persists a failed run without calling the judge when fewer than two candidates succeed", async () => {
  const saved: unknown[] = [];
  const chat = client(new Set(["acme/b", "acme/c"]));
  const run = await pipeline(chat, saved).create(input);
  assert.equal(run.status, "failed");
  assert.equal(run.judgeEvaluations.length, 0);
  assert.equal(
    chat.calls.filter((call) => call.modelId === "acme/judge").length,
    0,
  );
  assert.equal(saved[0], run);
});

function pipeline(chat: FakeChat, saved: unknown[]): GenerationPipeline {
  let id = 0;
  return new GenerationPipeline({
    weather: { resolve: async () => weather },
    catalog: { list: async () => models },
    chat,
    history: {
      save: async (run) => {
        saved.push(run);
      },
    },
    now: () => new Date("2026-08-25T12:00:00Z"),
    createId: () => `id-${++id}`,
  });
}
class FakeChat implements CompletionClient {
  readonly calls: { modelId: string; messages: unknown }[] = [];
  constructor(private readonly failures = new Set<string>()) {}
  async complete(
    modelId: string,
    messages: never,
  ): Promise<{
    content: string;
    usage: { promptTokens: number; completionTokens: number };
  }> {
    this.calls.push({ modelId, messages });
    if (this.failures.has(modelId)) throw new Error("provider unavailable");
    if (modelId === "acme/judge")
      return {
        content: JSON.stringify({
          evaluations: ["A", "B", "C"].map((letter, index) => ({
            candidateLabel: `Candidate ${letter}`,
            instructionFollowing: rubric(7 + index),
            lyricalQuality: rubric(7),
            creativity: rubric(8),
            weatherRelevance: rubric(9),
          })),
        }),
        usage: { promptTokens: 10, completionTokens: 10 },
      };
    return {
      content: `${modelId} lyrics`,
      usage: { promptTokens: 100, completionTokens: 50 },
    };
  }
}
function client(failures?: Set<string>): FakeChat {
  return new FakeChat(failures);
}
function rubric(score: number) {
  return { score, reasoning: "short reason" };
}
