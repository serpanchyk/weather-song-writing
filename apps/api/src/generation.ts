import {
  rankCandidateOutputs,
  type CandidateJudgeEvaluation,
  type CandidateOutput,
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
          `OpenRouter request failed (${response.status}).`,
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

  async create(input: CreateRunInput): Promise<GenerationRun> {
    const weather = await this.dependencies.weather.resolve(input);
    const models = await this.dependencies.catalog.list({
      includeExpensive: true,
    });
    const modelById = new Map(models.map((model) => [model.id, model]));
    const candidateOutputs = await Promise.all(
      input.candidateModelIds.map((modelId) =>
        this.generateCandidate(modelId, input, weather, modelById.get(modelId)),
      ),
    );
    const successful = candidateOutputs.filter(
      (output) => output.status === "succeeded",
    );
    const judgeModelId = input.judgeModelId ?? DEFAULT_JUDGE_MODEL_ID;
    const base = this.newRun(input, weather, candidateOutputs, judgeModelId);

    if (successful.length < 2) {
      const failed: GenerationRun = {
        ...base,
        status: "failed",
        errorMessage: "Fewer than two candidate models generated lyrics.",
      };
      await this.dependencies.history.save(failed);
      return failed;
    }

    try {
      const evaluations = await this.judge(
        input,
        weather,
        candidateOutputs,
        judgeModelId,
      );
      const evaluationById = new Map(
        evaluations.map((evaluation) => [
          evaluation.candidateOutputId,
          evaluation,
        ]),
      );
      const rankings = rankCandidateOutputs(
        successful.map((output) => ({
          candidateOutputId: output.id,
          scores: evaluationById.get(output.id)!.scores,
          estimatedCostUsd: output.estimatedCostUsd,
          responseTimeMs: output.responseTimeMs,
        })),
      );
      const top = rankings.find((ranking) => ranking.rank === 1) ?? null;
      const completed: GenerationRun = {
        ...base,
        status:
          successful.length === candidateOutputs.length
            ? "completed"
            : "partial",
        topCandidateOutputId: top?.candidateOutputId ?? null,
        judgeEvaluations: evaluations,
        rankings,
      };
      await this.dependencies.history.save(completed);
      return completed;
    } catch (error) {
      const failed: GenerationRun = {
        ...base,
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Judge evaluation failed.",
      };
      await this.dependencies.history.save(failed);
      return failed;
    }
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
      id: (this.dependencies.createId ?? crypto.randomUUID)(),
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

  private async generateCandidate(
    modelId: string,
    input: CreateRunInput,
    weather: WeatherSummary,
    model: ModelCatalogEntry | undefined,
  ): Promise<CandidateOutput> {
    const start = performance.now();
    const id = (this.dependencies.createId ?? crypto.randomUUID)();
    try {
      const response = await this.dependencies.chat.complete(
        modelId,
        buildCandidateLyricsPrompt(input, weather),
      );
      return {
        id,
        modelId,
        status: "succeeded",
        lyrics: response.content,
        responseTimeMs: Math.max(1, Math.round(performance.now() - start)),
        estimatedCostUsd: estimateCost(response.usage, model),
        errorMessage: null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Generation failed.";
      return {
        id,
        modelId,
        status: message.includes("timed out") ? "timed_out" : "failed",
        lyrics: null,
        responseTimeMs: Math.max(1, Math.round(performance.now() - start)),
        estimatedCostUsd: null,
        errorMessage: message,
      };
    }
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
