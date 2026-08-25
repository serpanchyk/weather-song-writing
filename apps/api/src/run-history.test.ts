import assert from "node:assert/strict";
import test from "node:test";

import type { GenerationRun } from "@weather-song-writing/contracts";

import { RunHistoryRepository } from "./run-history.js";

const completedRun = (id = "run-2"): GenerationRun => ({
  id,
  status: "completed",
  createdAt:
    id === "run-1" ? "2026-08-25T10:00:00.000Z" : "2026-08-25T11:00:00.000Z",
  completedAt: "2026-08-25T11:01:00.000Z",
  input: {
    location: { kind: "city", city: "Lviv" },
    localDateTime: "2026-08-25T14:00",
    genre: "indie",
    language: "uk",
    lyricsStructure: "verse-chorus",
    mood: "dreamy",
    candidateModelIds: ["first", "second"],
  },
  weather: {
    displayLocation: "Lviv",
    latitude: 49.84,
    longitude: 24.03,
    localDateTime: "2026-08-25T14:00",
    timezone: "Europe/Kyiv",
    temperatureCelsius: 22,
    apparentTemperatureCelsius: 22,
    precipitationMm: 0,
    windSpeedKph: 12,
    weatherDescription: "Clear",
  },
  successfulOutputCount: 2,
  topCandidateOutputId: "output-1",
  judgeModelId: "judge",
  candidateOutputs: [
    {
      id: "output-1",
      modelId: "first",
      status: "succeeded",
      lyrics: "First lyrics",
      responseTimeMs: 100,
      estimatedCostUsd: 0.01,
      errorMessage: null,
    },
    {
      id: "output-2",
      modelId: "second",
      status: "succeeded",
      lyrics: "Second lyrics",
      responseTimeMs: 200,
      estimatedCostUsd: 0.02,
      errorMessage: null,
    },
  ],
  judgeEvaluations: [evaluation("output-1", 9), evaluation("output-2", 8)],
  rankings: [ranking("output-1", 1, 9), ranking("output-2", 2, 8)],
  errorMessage: null,
});

function evaluation(candidateOutputId: string, score: number) {
  return {
    candidateOutputId,
    scores: {
      instructionFollowing: { score, reasoning: "instruction" },
      lyricalQuality: { score, reasoning: "quality" },
      creativity: { score, reasoning: "creative" },
      weatherRelevance: { score, reasoning: "weather" },
    },
  };
}
function ranking(
  candidateOutputId: string,
  rank: number,
  qualityScore: number,
) {
  return {
    candidateOutputId,
    status: "ranked" as const,
    qualityScore,
    costScore: 1,
    speedScore: 1,
    overallValue: qualityScore,
    rank,
  };
}

test("saves and reloads a completed run with every history detail", async () => {
  const repository = new RunHistoryRepository(
    new MemoryD1() as unknown as D1Database,
  );
  const run = completedRun();
  await repository.save(run);
  assert.deepEqual(await repository.getById(run.id), run);
});

test("persists partial and failed runs without inventing judge data", async () => {
  const repository = new RunHistoryRepository(
    new MemoryD1() as unknown as D1Database,
  );
  const partial: GenerationRun = {
    ...completedRun(),
    status: "partial",
    candidateOutputs: [
      ...completedRun().candidateOutputs,
      {
        id: "output-3",
        modelId: "third",
        status: "timed_out",
        lyrics: null,
        responseTimeMs: null,
        estimatedCostUsd: null,
        errorMessage: "Timed out",
      },
    ],
    successfulOutputCount: 2,
    errorMessage: "One model timed out",
  };
  const failed: GenerationRun = {
    ...completedRun("failed-run"),
    status: "failed",
    completedAt: null,
    successfulOutputCount: 1,
    topCandidateOutputId: null,
    weather: null,
    judgeModelId: null,
    candidateOutputs: [
      {
        id: "failed-output",
        modelId: "first",
        status: "failed",
        lyrics: null,
        responseTimeMs: null,
        estimatedCostUsd: null,
        errorMessage: "Provider error",
      },
    ],
    judgeEvaluations: [],
    rankings: [],
    errorMessage: "Fewer than two candidates succeeded",
  };
  await repository.save(partial);
  await repository.save(failed);
  assert.equal(
    (await repository.getById(partial.id))?.candidateOutputs.at(-1)?.status,
    "timed_out",
  );
  assert.deepEqual((await repository.getById(failed.id))?.judgeEvaluations, []);
  assert.deepEqual((await repository.getById(failed.id))?.rankings, []);
});

test("lists summaries newest first with a continuation cursor", async () => {
  const repository = new RunHistoryRepository(
    new MemoryD1() as unknown as D1Database,
  );
  await repository.save(completedRun("run-1"));
  await repository.save(completedRun("run-2"));
  const first = await repository.list(null, 1);
  assert.deepEqual(
    first.runs.map((run) => run.id),
    ["run-2"],
  );
  assert.notEqual(first.nextCursor, null);
  const second = await repository.list(first.nextCursor, 1);
  assert.deepEqual(
    second.runs.map((run) => run.id),
    ["run-1"],
  );
  assert.equal(second.nextCursor, null);
});

class MemoryD1 {
  private readonly runs = new Map<string, Record<string, unknown>>();
  private readonly outputs = new Map<string, Record<string, unknown>>();
  private readonly evaluations = new Map<string, Record<string, unknown>>();
  private readonly rankings = new Map<string, Record<string, unknown>>();

  prepare(query: string): MemoryStatement {
    return new MemoryStatement(this, query);
  }
  async batch(
    statements: MemoryStatement[],
  ): Promise<
    Array<{ success: true; results: unknown[]; meta: Record<string, unknown> }>
  > {
    for (const statement of statements) this.insert(statement);
    return statements.map(() => ({ success: true, results: [], meta: {} }));
  }
  insert(statement: MemoryStatement): void {
    const values = statement.values;
    if (statement.query.includes("INSERT INTO runs"))
      this.runs.set(values[0] as string, {
        id: values[0],
        status: values[1],
        created_at: values[2],
        completed_at: values[3],
        input_json: values[4],
        weather_json: values[5],
        judge_model_id: values[6],
        successful_output_count: values[7],
        top_candidate_output_id: values[8],
        error_message: values[9],
      });
    else if (statement.query.includes("INSERT INTO candidate_outputs"))
      this.outputs.set(values[0] as string, {
        id: values[0],
        run_id: values[1],
        position: values[2],
        model_id: values[3],
        status: values[4],
        lyrics: values[5],
        response_time_ms: values[6],
        estimated_cost_usd: values[7],
        error_message: values[8],
      });
    else if (statement.query.includes("INSERT INTO judge_evaluations"))
      this.evaluations.set(values[0] as string, {
        candidate_output_id: values[0],
        instruction_following_score: values[1],
        instruction_following_reasoning: values[2],
        lyrical_quality_score: values[3],
        lyrical_quality_reasoning: values[4],
        creativity_score: values[5],
        creativity_reasoning: values[6],
        weather_relevance_score: values[7],
        weather_relevance_reasoning: values[8],
      });
    else if (statement.query.includes("INSERT INTO candidate_rankings"))
      this.rankings.set(values[0] as string, {
        candidate_output_id: values[0],
        status: values[1],
        quality_score: values[2],
        cost_score: values[3],
        speed_score: values[4],
        overall_value: values[5],
        rank: values[6],
      });
  }
  rows(query: string, values: readonly unknown[]): Record<string, unknown>[] {
    if (query.includes("FROM runs") && !query.includes("SELECT *")) {
      const all = [...this.runs.values()].sort(
        (a, b) =>
          String(b.created_at).localeCompare(String(a.created_at)) ||
          String(b.id).localeCompare(String(a.id)),
      );
      const filtered = query.includes("WHERE created_at")
        ? all.filter(
            (row) =>
              String(row.created_at) < String(values[0]) ||
              (row.created_at === values[1] &&
                String(row.id) < String(values[2])),
          )
        : all;
      return filtered.slice(0, values.at(-1) as number);
    }
    if (query.includes("SELECT * FROM runs")) {
      const row = this.runs.get(values[0] as string);
      return row === undefined ? [] : [row];
    }
    const runId = values[0] as string;
    const outputIds = new Set(
      [...this.outputs.values()]
        .filter((row) => row.run_id === runId)
        .map((row) => row.id),
    );
    if (query.includes("FROM judge_evaluations"))
      return [...this.evaluations.values()].filter((row) =>
        outputIds.has(row.candidate_output_id),
      );
    if (query.includes("FROM candidate_rankings"))
      return [...this.rankings.values()].filter((row) =>
        outputIds.has(row.candidate_output_id),
      );
    if (query.includes("FROM candidate_outputs"))
      return [...this.outputs.values()]
        .filter((row) => row.run_id === runId)
        .sort((a, b) => Number(a.position) - Number(b.position));
    return [];
  }
}
class MemoryStatement {
  values: readonly unknown[] = [];
  constructor(
    readonly database: MemoryD1,
    readonly query: string,
  ) {}
  bind(...values: unknown[]): this {
    this.values = values;
    return this;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.database.rows(this.query, this.values) as T[] };
  }
  async first<T>(): Promise<T | null> {
    return (
      (this.database.rows(this.query, this.values)[0] as T | undefined) ?? null
    );
  }
}
