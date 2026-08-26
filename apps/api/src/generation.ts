import {
  rankCandidateOutputs,
  type CandidateJudgeEvaluation,
  type CandidateOutput,
  type CandidateRanking,
  type CreateRunInput,
  type GenerationRun,
  type JudgeScores,
  type ModelCatalogEntry,
  type WeatherSummary,
} from "@weather-song-writing/contracts";

import { OpenRouterModelCatalog } from "./model-catalog.js";
import {
  buildBlindJudgePrompt,
  buildCandidateLyricsPrompt,
  JUDGE_RESPONSE_JSON_SCHEMA,
  type ChatMessage,
} from "./prompts.js";
import { RunHistoryRepository } from "./run-history.js";
import { OpenMeteoWeatherResolver } from "./weather.js";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_JUDGE_MODEL_ID = "openai/gpt-5.6-luna-pro";

export class GenerationServiceError extends Error {}

interface CompletionUsage {
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
}

interface CompletionResult {
  readonly content: string;
  readonly usage: CompletionUsage;
}

export interface CompletionClient {
  complete(
    modelId: string,
    messages: readonly ChatMessage[],
    responseFormat?: unknown,
  ): Promise<CompletionResult>;
}

export type GenerationProgress =
  | { readonly stage: "weather" }
  | { readonly stage: "catalog" }
  | { readonly stage: "candidate_started"; readonly modelId: string }
  | {
      readonly stage: "candidate_finished";
      readonly output: CandidateOutput;
    }
  | {
      readonly stage: "judge_started";
      readonly judgeModelId: string;
      readonly modelId: string;
    }
  | {
      readonly stage: "judge_finished";
      readonly modelId: string;
      readonly evaluation: CandidateJudgeEvaluation;
    }
  | {
      readonly stage: "judge_failed";
      readonly modelId: string;
      readonly message: string;
    }
  | {
      readonly stage: "ranking";
      readonly rankings: readonly CandidateRanking[];
    }
  | { readonly stage: "saving" };

type ProgressCallback = (progress: GenerationProgress) => void | Promise<void>;

export class OpenRouterChatClient implements CompletionClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly timeoutMs = 45_000,
  ) {}

  async complete(
    modelId: string,
    messages: readonly ChatMessage[],
    responseFormat?: unknown,
  ): Promise<CompletionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          ...(responseFormat === undefined
            ? {}
            : {
                response_format: {
                  type: "json_schema",
                  json_schema: responseFormat,
                },
              }),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new GenerationServiceError(
          userFacingOpenRouterError(response.status),
        );
      }
      return parseCompletion(await response.json());
    } catch (error) {
      if (error instanceof GenerationServiceError) throw error;
      if (controller.signal.aborted) {
        throw new GenerationServiceError("OpenRouter request timed out.");
      }
      throw new GenerationServiceError(
        "OpenRouter request is temporarily unavailable.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function userFacingOpenRouterError(status: number): string {
  if (status === 401 || status === 403)
    return "The model provider rejected this request. Check that the selected model is available to this API key.";
  if (status === 429)
    return "The model provider is rate-limiting requests. Please try this model again shortly.";
  if (status >= 500)
    return "The model provider is temporarily unavailable. Please try again later or choose another model.";
  return "The model provider could not process this request.";
}

export class GenerationPipeline {
  constructor(
    private readonly dependencies: {
      readonly weather: Pick<OpenMeteoWeatherResolver, "resolve">;
      readonly catalog: Pick<OpenRouterModelCatalog, "list">;
      readonly chat: CompletionClient;
      readonly history: Pick<RunHistoryRepository, "save">;
      readonly now?: () => Date;
      readonly createId?: () => string;
    },
  ) {}

  async create(
    input: CreateRunInput,
    onProgress?: ProgressCallback,
  ): Promise<GenerationRun> {
    await onProgress?.({ stage: "weather" });
    const weather = await this.dependencies.weather.resolve(input);
    await onProgress?.({ stage: "catalog" });
    const models = await this.dependencies.catalog.list({
      includeExpensive: true,
    });
    const modelById = new Map(models.map((model) => [model.id, model]));
    const judgeModelId = input.judgeModelId ?? DEFAULT_JUDGE_MODEL_ID;
    const evaluations = new Map<string, CandidateJudgeEvaluation>();
    const generatedOutputs: CandidateOutput[] = [];
    let rankings: readonly CandidateRanking[] = [];
    const candidateOutputs = await Promise.all(
      input.candidateModelIds.map((modelId) =>
        this.generateAndJudgeCandidate(
          modelId,
          input,
          weather,
          modelById.get(modelId),
          judgeModelId,
          evaluations,
          generatedOutputs,
          onProgress,
        ),
      ),
    );
    const base = this.newRun(input, weather, candidateOutputs, judgeModelId);
    const successful = candidateOutputs.filter(
      (output) => output.status === "succeeded",
    );
    const judged = [...evaluations.values()];
    rankings = this.rank(candidateOutputs, evaluations);
    const top = rankings.find((ranking) => ranking.rank === 1) ?? null;
    const completed: GenerationRun = {
      ...base,
      status:
        judged.length === 0
          ? "failed"
          : successful.length === candidateOutputs.length &&
              judged.length === successful.length
            ? "completed"
            : "partial",
      topCandidateOutputId: top?.candidateOutputId ?? null,
      judgeEvaluations: judged,
      rankings,
      errorMessage:
        judged.length === 0 ? "No generated lyrics could be evaluated." : null,
    };
    await onProgress?.({ stage: "saving" });
    await this.dependencies.history.save(completed);
    return completed;
  }

  private newRun(
    input: CreateRunInput,
    weather: WeatherSummary,
    candidateOutputs: readonly CandidateOutput[],
    judgeModelId: string,
  ): GenerationRun {
    const timestamp = (
      this.dependencies.now ?? (() => new Date())
    )().toISOString();
    return {
      id: nextId(this.dependencies.createId),
      status: "failed",
      createdAt: timestamp,
      completedAt: timestamp,
      input,
      weather,
      candidateOutputs,
      judgeModelId,
      judgeEvaluations: [],
      rankings: [],
      successfulOutputCount: candidateOutputs.filter(
        (output) => output.status === "succeeded",
      ).length,
      topCandidateOutputId: null,
      errorMessage: null,
    };
  }

  private async generateAndJudgeCandidate(
    modelId: string,
    input: CreateRunInput,
    weather: WeatherSummary,
    model: ModelCatalogEntry | undefined,
    judgeModelId: string,
    evaluations: Map<string, CandidateJudgeEvaluation>,
    generatedOutputs: CandidateOutput[],
    onProgress?: ProgressCallback,
  ): Promise<CandidateOutput> {
    const start = performance.now();
    const id = nextId(this.dependencies.createId);
    await onProgress?.({ stage: "candidate_started", modelId });
    try {
      const response = await this.dependencies.chat.complete(
        modelId,
        buildCandidateLyricsPrompt(input, weather),
      );
      const output: CandidateOutput = {
        id,
        modelId,
        status: "succeeded",
        lyrics: response.content,
        responseTimeMs: Math.max(1, Math.round(performance.now() - start)),
        estimatedCostUsd: estimateCost(response.usage, model),
        errorMessage: null,
      };
      generatedOutputs.push(output);
      await onProgress?.({ stage: "candidate_finished", output });
      await onProgress?.({ stage: "judge_started", judgeModelId, modelId });
      try {
        const evaluation = await this.judge(
          input,
          weather,
          [output],
          judgeModelId,
        );
        evaluations.set(output.id, evaluation[0]!);
        await onProgress?.({
          stage: "judge_finished",
          modelId,
          evaluation: evaluation[0]!,
        });
        await onProgress?.({
          stage: "ranking",
          rankings: this.rank(generatedOutputs, evaluations),
        });
      } catch (error) {
        await onProgress?.({
          stage: "judge_failed",
          modelId,
          message:
            error instanceof Error
              ? error.message
              : "The judge could not evaluate these lyrics.",
        });
      }
      return output;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Generation failed.";
      const output: CandidateOutput = {
        id,
        modelId,
        status: message.includes("timed out") ? "timed_out" : "failed",
        lyrics: null,
        responseTimeMs: Math.max(1, Math.round(performance.now() - start)),
        estimatedCostUsd: null,
        errorMessage: message,
      };
      generatedOutputs.push(output);
      await onProgress?.({ stage: "candidate_finished", output });
      return output;
    }
  }

  private rank(
    outputs: readonly CandidateOutput[],
    evaluations: ReadonlyMap<string, CandidateJudgeEvaluation>,
  ): readonly CandidateRanking[] {
    return rankCandidateOutputs(
      outputs
        .filter(
          (output) =>
            output.status === "succeeded" && evaluations.has(output.id),
        )
        .map((output) => ({
          candidateOutputId: output.id,
          scores: evaluations.get(output.id)!.scores,
          estimatedCostUsd: output.estimatedCostUsd,
          responseTimeMs: output.responseTimeMs,
        })),
    );
  }

  private async judge(
    input: CreateRunInput,
    weather: WeatherSummary,
    outputs: readonly CandidateOutput[],
    judgeModelId: string,
  ): Promise<readonly CandidateJudgeEvaluation[]> {
    const prompt = buildBlindJudgePrompt(input, weather, outputs);
    const response = await this.dependencies.chat.complete(
      judgeModelId,
      prompt.messages,
      JUDGE_RESPONSE_JSON_SCHEMA,
    );
    return parseJudgeEvaluations(response.content, prompt.candidates);
  }
}

function estimateCost(
  usage: CompletionUsage,
  model: ModelCatalogEntry | undefined,
): number | null {
  if (
    model?.pricing === null ||
    model?.pricing === undefined ||
    model.pricing.promptUsdPerMillionTokens === null ||
    model.pricing.completionUsdPerMillionTokens === null ||
    usage.promptTokens === null ||
    usage.completionTokens === null
  )
    return null;
  return (
    (usage.promptTokens * model.pricing.promptUsdPerMillionTokens +
      usage.completionTokens * model.pricing.completionUsdPerMillionTokens) /
    1_000_000
  );
}

function nextId(createId: (() => string) | undefined): string {
  return createId === undefined ? crypto.randomUUID() : createId();
}

function parseCompletion(value: unknown): CompletionResult {
  if (
    !isRecord(value) ||
    !Array.isArray(value.choices) ||
    !isRecord(value.choices[0]) ||
    !isRecord(value.choices[0].message) ||
    typeof value.choices[0].message.content !== "string"
  ) {
    throw new GenerationServiceError(
      "OpenRouter returned an invalid completion.",
    );
  }
  const usage = isRecord(value.usage) ? value.usage : {};
  return {
    content: value.choices[0].message.content,
    usage: {
      promptTokens: finiteNumber(usage.prompt_tokens),
      completionTokens: finiteNumber(usage.completion_tokens),
    },
  };
}

function parseJudgeEvaluations(
  content: string,
  candidates: readonly {
    readonly label: string;
    readonly candidateOutputId: string;
  }[],
): readonly CandidateJudgeEvaluation[] {
  let body: unknown;
  try {
    body = JSON.parse(content);
  } catch {
    throw new GenerationServiceError("Judge returned invalid JSON.");
  }
  if (!isRecord(body) || !Array.isArray(body.evaluations))
    throw new GenerationServiceError("Judge returned an invalid evaluation.");
  const byLabel = new Map<string, Record<string, unknown>>();
  for (const value of body.evaluations) {
    if (isRecord(value) && typeof value.candidateLabel === "string") {
      byLabel.set(value.candidateLabel, value);
    }
  }
  return candidates.map(({ label, candidateOutputId }) => {
    const value = byLabel.get(label);
    const scores = value === undefined ? null : parseScores(value);
    if (scores === null)
      throw new GenerationServiceError("Judge did not score every candidate.");
    return { candidateOutputId, scores };
  });
}

function parseScores(value: Record<string, unknown>): JudgeScores | null {
  const score = (key: string) =>
    isRecord(value[key]) &&
    finiteNumber(value[key].score) !== null &&
    Number.isInteger(finiteNumber(value[key].score)) &&
    finiteNumber(value[key].score)! >= 0 &&
    finiteNumber(value[key].score)! <= 10 &&
    typeof value[key].reasoning === "string" &&
    value[key].reasoning.length > 0
      ? {
          score: finiteNumber(value[key].score)!,
          reasoning: value[key].reasoning,
        }
      : null;
  const instructionFollowing = score("instructionFollowing");
  const lyricalQuality = score("lyricalQuality");
  const creativity = score("creativity");
  const weatherRelevance = score("weatherRelevance");
  return instructionFollowing &&
    lyricalQuality &&
    creativity &&
    weatherRelevance
    ? { instructionFollowing, lyricalQuality, creativity, weatherRelevance }
    : null;
}
function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
