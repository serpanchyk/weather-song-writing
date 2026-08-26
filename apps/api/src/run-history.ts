import type {
  CandidateJudgeEvaluation,
  CandidateOutput,
  CandidateRanking,
  CreateRunInput,
  GenerationRun,
  RunHistoryPage,
  RunStatus,
  WeatherSummary,
} from "@weather-song-writing/contracts";

interface RunRow {
  readonly id: string;
  readonly status: RunStatus;
  readonly created_at: string;
  readonly completed_at: string | null;
  readonly input_json: string;
  readonly weather_json: string | null;
  readonly judge_model_id: string | null;
  readonly successful_output_count: number;
  readonly top_candidate_output_id: string | null;
  readonly error_message: string | null;
}

interface CandidateOutputRow {
  readonly id: string;
  readonly model_id: string;
  readonly status: CandidateOutput["status"];
  readonly lyrics: string | null;
  readonly response_time_ms: number | null;
  readonly estimated_cost_usd: number | null;
  readonly error_message: string | null;
}

interface EvaluationRow {
  readonly candidate_output_id: string;
  readonly instruction_following_score: number;
  readonly instruction_following_reasoning: string;
  readonly lyrical_quality_score: number;
  readonly lyrical_quality_reasoning: string;
  readonly creativity_score: number;
  readonly creativity_reasoning: string;
  readonly weather_relevance_score: number;
  readonly weather_relevance_reasoning: string;
}

interface RankingRow {
  readonly candidate_output_id: string;
  readonly status: CandidateRanking["status"];
  readonly quality_score: number;
  readonly cost_score: number | null;
  readonly speed_score: number | null;
  readonly overall_value: number | null;
  readonly rank: number | null;
}

interface Cursor {
  readonly createdAt: string;
  readonly id: string;
}

export class InvalidHistoryCursorError extends Error {
  constructor() {
    super("cursor must be a valid history cursor.");
  }
}

export class RunHistoryRepository {
  constructor(private readonly database: D1Database) {}

  async save(run: GenerationRun): Promise<void> {
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          `INSERT INTO runs (
            id, status, created_at, completed_at, input_json, weather_json,
            judge_model_id, successful_output_count, top_candidate_output_id, error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          run.id,
          run.status,
          run.createdAt,
          run.completedAt,
          JSON.stringify(run.input),
          run.weather === null ? null : JSON.stringify(run.weather),
          run.judgeModelId,
          run.successfulOutputCount,
          run.topCandidateOutputId,
          run.errorMessage,
        ),
    ];

    for (let index = 0; index < run.candidateOutputs.length; index += 1) {
      const output = run.candidateOutputs[index]!;
      statements.push(
        this.database
          .prepare(
            `INSERT INTO candidate_outputs (
              id, run_id, position, model_id, status, lyrics, response_time_ms,
              estimated_cost_usd, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            output.id,
            run.id,
            index,
            output.modelId,
            output.status,
            output.lyrics,
            output.responseTimeMs,
            output.estimatedCostUsd,
            output.errorMessage,
          ),
      );
    }

    for (const evaluation of run.judgeEvaluations) {
      const { scores } = evaluation;
      statements.push(
        this.database
          .prepare(
            `INSERT INTO judge_evaluations (
              candidate_output_id, instruction_following_score, instruction_following_reasoning,
              lyrical_quality_score, lyrical_quality_reasoning, creativity_score,
              creativity_reasoning, weather_relevance_score, weather_relevance_reasoning
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            evaluation.candidateOutputId,
            scores.instructionFollowing.score,
            scores.instructionFollowing.reasoning,
            scores.lyricalQuality.score,
            scores.lyricalQuality.reasoning,
            scores.creativity.score,
            scores.creativity.reasoning,
            scores.weatherRelevance.score,
            scores.weatherRelevance.reasoning,
          ),
      );
    }

    for (const ranking of run.rankings) {
      statements.push(
        this.database
          .prepare(
            `INSERT INTO candidate_rankings (
              candidate_output_id, status, quality_score, cost_score, speed_score,
              overall_value, rank
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            ranking.candidateOutputId,
            ranking.status,
            ranking.qualityScore,
            ranking.costScore,
            ranking.speedScore,
            ranking.overallValue,
            ranking.rank,
          ),
      );
    }

    await this.database.batch(statements);
  }

  async list(
    cursorValue: string | null,
    limit: number,
  ): Promise<RunHistoryPage> {
    const cursor = cursorValue === null ? null : decodeCursor(cursorValue);
    const rows = (
      await (cursor === null
        ? this.database
            .prepare(
              `SELECT id, status, created_at, input_json, successful_output_count,
              top_candidate_output_id FROM runs ORDER BY created_at DESC, id DESC LIMIT ?`,
            )
            .bind(limit + 1)
            .all<
              Pick<
                RunRow,
                | "id"
                | "status"
                | "created_at"
                | "input_json"
                | "successful_output_count"
                | "top_candidate_output_id"
              >
            >()
        : this.database
            .prepare(
              `SELECT id, status, created_at, input_json, successful_output_count,
              top_candidate_output_id FROM runs
              WHERE created_at < ? OR (created_at = ? AND id < ?)
              ORDER BY created_at DESC, id DESC LIMIT ?`,
            )
            .bind(cursor.createdAt, cursor.createdAt, cursor.id, limit + 1)
            .all<
              Pick<
                RunRow,
                | "id"
                | "status"
                | "created_at"
                | "input_json"
                | "successful_output_count"
                | "top_candidate_output_id"
              >
            >())
    ).results;
    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    return {
      runs: pageRows.map(toSummary),
      nextCursor:
        rows.length > limit && last !== undefined
          ? encodeCursor({ createdAt: last.created_at, id: last.id })
          : null,
    };
  }

  async getById(id: string): Promise<GenerationRun | null> {
    const run = await this.database
      .prepare("SELECT * FROM runs WHERE id = ?")
      .bind(id)
      .first<RunRow>();
    if (run === null) return null;
    const [outputs, evaluations, rankings] = await Promise.all([
      this.database
        .prepare(
          "SELECT id, model_id, status, lyrics, response_time_ms, estimated_cost_usd, error_message FROM candidate_outputs WHERE run_id = ? ORDER BY position ASC",
        )
        .bind(id)
        .all<CandidateOutputRow>(),
      this.database
        .prepare(
          "SELECT candidate_output_id, instruction_following_score, instruction_following_reasoning, lyrical_quality_score, lyrical_quality_reasoning, creativity_score, creativity_reasoning, weather_relevance_score, weather_relevance_reasoning FROM judge_evaluations WHERE candidate_output_id IN (SELECT id FROM candidate_outputs WHERE run_id = ?)",
        )
        .bind(id)
        .all<EvaluationRow>(),
      this.database
        .prepare(
          "SELECT candidate_output_id, status, quality_score, cost_score, speed_score, overall_value, rank FROM candidate_rankings WHERE candidate_output_id IN (SELECT id FROM candidate_outputs WHERE run_id = ?)",
        )
        .bind(id)
        .all<RankingRow>(),
    ]);
    return {
      ...toSummary(run),
      completedAt: run.completed_at,
      weather: parseJson<WeatherSummary | null>(run.weather_json),
      candidateOutputs: outputs.results.map(toOutput),
      judgeModelId: run.judge_model_id,
      judgeEvaluations: evaluations.results.map(toEvaluation),
      rankings: rankings.results.map(toRanking),
      errorMessage: run.error_message,
    };
  }
}

function toSummary(
  row: Pick<
    RunRow,
    | "id"
    | "status"
    | "created_at"
    | "input_json"
    | "successful_output_count"
    | "top_candidate_output_id"
  >,
) {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    input: parseJson<CreateRunInput>(row.input_json),
    successfulOutputCount: row.successful_output_count,
    topCandidateOutputId: row.top_candidate_output_id,
  };
}
function toOutput(row: CandidateOutputRow): CandidateOutput {
  return {
    id: row.id,
    modelId: row.model_id,
    status: row.status,
    lyrics: row.lyrics,
    responseTimeMs: row.response_time_ms,
    estimatedCostUsd: row.estimated_cost_usd,
    errorMessage: row.error_message,
  };
}
function toEvaluation(row: EvaluationRow): CandidateJudgeEvaluation {
  return {
    candidateOutputId: row.candidate_output_id,
    scores: {
      instructionFollowing: {
        score: row.instruction_following_score,
        reasoning: row.instruction_following_reasoning,
      },
      lyricalQuality: {
        score: row.lyrical_quality_score,
        reasoning: row.lyrical_quality_reasoning,
      },
      creativity: {
        score: row.creativity_score,
        reasoning: row.creativity_reasoning,
      },
      weatherRelevance: {
        score: row.weather_relevance_score,
        reasoning: row.weather_relevance_reasoning,
      },
    },
  };
}
function toRanking(row: RankingRow): CandidateRanking {
  return {
    candidateOutputId: row.candidate_output_id,
    status: row.status,
    qualityScore: row.quality_score,
    costScore: row.cost_score,
    speedScore: row.speed_score,
    overallValue: row.overall_value,
    rank: row.rank,
  };
}
function parseJson<T>(value: string | null): T {
  return value === null ? (null as T) : (JSON.parse(value) as T);
}
function encodeCursor(cursor: Cursor): string {
  return btoa(JSON.stringify(cursor))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
function decodeCursor(value: string): Cursor {
  try {
    const padded =
      value.replaceAll("-", "+").replaceAll("_", "/") +
      "=".repeat((4 - (value.length % 4)) % 4);
    const cursor: unknown = JSON.parse(atob(padded));
    if (
      typeof cursor !== "object" ||
      cursor === null ||
      !isStringRecord(cursor) ||
      typeof cursor.createdAt !== "string" ||
      typeof cursor.id !== "string"
    )
      throw new Error();
    return { createdAt: cursor.createdAt, id: cursor.id };
  } catch {
    throw new InvalidHistoryCursorError();
  }
}
function isStringRecord(value: object): value is Record<string, unknown> {
  return !Array.isArray(value);
}
