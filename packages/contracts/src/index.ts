export interface ControlledOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export const GENRE_OPTIONS = [
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "indie", label: "Indie" },
  { value: "rap", label: "Rap" },
  { value: "jazz", label: "Jazz" },
  { value: "folk", label: "Folk" },
  { value: "electronic", label: "Electronic" },
] as const satisfies readonly ControlledOption<string>[];

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "uk", label: "Ukrainian" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pl", label: "Polish" },
] as const satisfies readonly ControlledOption<string>[];

export const LYRICS_STRUCTURE_OPTIONS = [
  { value: "verse-chorus", label: "Verse–chorus" },
  { value: "verse-chorus-verse-chorus", label: "Verse–chorus–verse–chorus" },
  {
    value: "verse-chorus-verse-chorus-bridge-chorus",
    label: "Verse–chorus–verse–chorus–bridge–chorus",
  },
  { value: "free-form", label: "Free-form" },
] as const satisfies readonly ControlledOption<string>[];

export const MOOD_OPTIONS = [
  { value: "melancholic", label: "Melancholic" },
  { value: "joyful", label: "Joyful" },
  { value: "dreamy", label: "Dreamy" },
  { value: "energetic", label: "Energetic" },
  { value: "dark", label: "Dark" },
  { value: "romantic", label: "Romantic" },
] as const satisfies readonly ControlledOption<string>[];

export type Genre = (typeof GENRE_OPTIONS)[number]["value"];
export type Language = (typeof LANGUAGE_OPTIONS)[number]["value"];
export type LyricsStructure =
  (typeof LYRICS_STRUCTURE_OPTIONS)[number]["value"];
export type Mood = (typeof MOOD_OPTIONS)[number]["value"];

export interface CityLocationInput {
  readonly kind: "city";
  readonly city: string;
}

export interface CoordinateLocationInput {
  readonly kind: "coordinates";
  readonly latitude: number;
  readonly longitude: number;
  readonly label?: string;
}

export type LocationInput = CityLocationInput | CoordinateLocationInput;

export interface WeatherMomentInput {
  readonly location: LocationInput;
  /** ISO-8601 local date-time, as emitted by a datetime-local form control. */
  readonly localDateTime: string;
}

export interface CreativeControls {
  readonly genre: Genre;
  readonly language: Language;
  readonly lyricsStructure: LyricsStructure;
  readonly mood: Mood;
}

export interface CreateRunInput extends WeatherMomentInput, CreativeControls {
  readonly candidateModelIds: readonly string[];
  readonly judgeModelId?: string;
}

export type ModelModality = "text" | "image" | "audio" | "video";

export interface ModelPricing {
  readonly promptUsdPerMillionTokens: number | null;
  readonly completionUsdPerMillionTokens: number | null;
}

export interface ModelCatalogEntry {
  readonly id: string;
  readonly displayName: string;
  readonly provider: string | null;
  readonly contextLength: number | null;
  readonly supportedModalities: readonly ModelModality[];
  readonly pricing: ModelPricing | null;
}

export interface WeatherSummary {
  readonly displayLocation: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly localDateTime: string;
  readonly timezone: string;
  readonly temperatureCelsius: number | null;
  readonly apparentTemperatureCelsius: number | null;
  readonly precipitationMm: number | null;
  readonly windSpeedKph: number | null;
  readonly weatherDescription: string;
}

export type CandidateOutputStatus = "succeeded" | "failed" | "timed_out";

export interface CandidateOutput {
  readonly id: string;
  readonly modelId: string;
  readonly status: CandidateOutputStatus;
  readonly lyrics: string | null;
  readonly responseTimeMs: number | null;
  readonly estimatedCostUsd: number | null;
  readonly errorMessage: string | null;
}

export interface RubricScore {
  readonly score: number;
  readonly reasoning: string;
}

export interface JudgeScores {
  readonly instructionFollowing: RubricScore;
  readonly lyricalQuality: RubricScore;
  readonly creativity: RubricScore;
  readonly weatherRelevance: RubricScore;
}

export interface CandidateJudgeEvaluation {
  readonly candidateOutputId: string;
  readonly scores: JudgeScores;
}

export type RankingStatus = "ranked" | "unranked";

export interface CandidateRanking {
  readonly candidateOutputId: string;
  readonly status: RankingStatus;
  readonly qualityScore: number;
  readonly costScore: number | null;
  readonly speedScore: number | null;
  readonly overallValue: number | null;
  readonly rank: number | null;
}

export type RunStatus = "completed" | "partial" | "failed";

export interface RunSummary {
  readonly id: string;
  readonly status: RunStatus;
  readonly createdAt: string;
  readonly input: CreateRunInput;
  readonly successfulOutputCount: number;
  readonly topCandidateOutputId: string | null;
}

export interface GenerationRun extends RunSummary {
  readonly completedAt: string | null;
  readonly weather: WeatherSummary | null;
  readonly candidateOutputs: readonly CandidateOutput[];
  readonly judgeModelId: string | null;
  readonly judgeEvaluations: readonly CandidateJudgeEvaluation[];
  readonly rankings: readonly CandidateRanking[];
  readonly errorMessage: string | null;
}

export interface RunHistoryPage {
  readonly runs: readonly RunSummary[];
  /** Opaque cursor for the next newest-first page, or null at the end. */
  readonly nextCursor: string | null;
}

export type ValidationIssueCode =
  | "required"
  | "invalid_option"
  | "invalid_location"
  | "invalid_date_time"
  | "candidate_model_count"
  | "duplicate_candidate_model"
  | "invalid_model_id";

export interface ValidationIssue {
  readonly field: string;
  readonly code: ValidationIssueCode;
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export function validateCreateRunInput(
  input: unknown,
): ValidationResult<CreateRunInput> {
  if (!isRecord(input)) {
    return invalid("input", "required", "A run input object is required.");
  }

  const issues: ValidationIssue[] = [];
  validateLocation(input.location, issues);
  validateLocalDateTime(input.localDateTime, issues);
  validateControlledValue(input.genre, GENRE_OPTIONS, "genre", issues);
  validateControlledValue(input.language, LANGUAGE_OPTIONS, "language", issues);
  validateControlledValue(
    input.lyricsStructure,
    LYRICS_STRUCTURE_OPTIONS,
    "lyricsStructure",
    issues,
  );
  validateControlledValue(input.mood, MOOD_OPTIONS, "mood", issues);
  validateCandidateModelIds(input.candidateModelIds, issues);

  if (
    input.judgeModelId !== undefined &&
    !isNonEmptyString(input.judgeModelId)
  ) {
    issues.push({
      field: "judgeModelId",
      code: "invalid_model_id",
      message: "Judge model ID must be a non-empty string when provided.",
    });
  }

  return issues.length === 0
    ? { ok: true, value: input as unknown as CreateRunInput }
    : { ok: false, issues };
}

export function calculateQualityScore(scores: JudgeScores): number {
  const values = [
    scores.instructionFollowing.score,
    scores.lyricalQuality.score,
    scores.creativity.score,
    scores.weatherRelevance.score,
  ];

  for (const value of values) {
    if (!Number.isFinite(value) || value < 0 || value > 10) {
      throw new RangeError(
        "Judge rubric scores must be finite numbers from 0 to 10.",
      );
    }
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function calculateCostScore(
  cheapestCandidateCostUsd: number,
  candidateCostUsd: number,
): number {
  assertPositiveFinite(cheapestCandidateCostUsd, "Cheapest candidate cost");
  assertPositiveFinite(candidateCostUsd, "Candidate cost");
  return cheapestCandidateCostUsd / candidateCostUsd;
}

export function calculateSpeedScore(
  fastestCandidateTimeMs: number,
  candidateTimeMs: number,
): number {
  assertPositiveFinite(
    fastestCandidateTimeMs,
    "Fastest candidate response time",
  );
  assertPositiveFinite(candidateTimeMs, "Candidate response time");
  return fastestCandidateTimeMs / candidateTimeMs;
}

export function calculateOverallValue(
  qualityScore: number,
  costScore: number,
  speedScore: number,
): number {
  if (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 10) {
    throw new RangeError("Quality score must be a finite number from 0 to 10.");
  }
  assertNormalizedScore(costScore, "Cost score");
  assertNormalizedScore(speedScore, "Speed score");

  return qualityScore * 0.75 + costScore * 10 * 0.15 + speedScore * 10 * 0.1;
}

export interface RankingInput {
  readonly candidateOutputId: string;
  readonly scores: JudgeScores;
  readonly estimatedCostUsd: number | null;
  readonly responseTimeMs: number | null;
}

export function rankCandidateOutputs(
  inputs: readonly RankingInput[],
): readonly CandidateRanking[] {
  const qualityById = new Map(
    inputs.map((input) => [
      input.candidateOutputId,
      calculateQualityScore(input.scores),
    ]),
  );
  const rankableInputs = inputs.filter(
    (input) =>
      isPositiveFinite(input.estimatedCostUsd) &&
      isPositiveFinite(input.responseTimeMs),
  );

  if (rankableInputs.length === 0) {
    return inputs.map((input) =>
      unranked(
        input.candidateOutputId,
        qualityById.get(input.candidateOutputId)!,
      ),
    );
  }

  const cheapestCost = Math.min(
    ...rankableInputs.map((input) => input.estimatedCostUsd!),
  );
  const fastestTime = Math.min(
    ...rankableInputs.map((input) => input.responseTimeMs!),
  );
  const rankedValues = rankableInputs
    .map((input) => {
      const qualityScore = qualityById.get(input.candidateOutputId)!;
      const costScore = calculateCostScore(
        cheapestCost,
        input.estimatedCostUsd!,
      );
      const speedScore = calculateSpeedScore(
        fastestTime,
        input.responseTimeMs!,
      );
      return {
        candidateOutputId: input.candidateOutputId,
        status: "ranked" as const,
        qualityScore,
        costScore,
        speedScore,
        overallValue: calculateOverallValue(
          qualityScore,
          costScore,
          speedScore,
        ),
      };
    })
    .sort((left, right) => right.overallValue - left.overallValue);

  let previousValue: number | null = null;
  let currentRank = 0;
  const ranked = rankedValues.map((ranking, index) => {
    if (ranking.overallValue !== previousValue) {
      currentRank = index + 1;
      previousValue = ranking.overallValue;
    }
    return { ...ranking, rank: currentRank };
  });

  const rankingById = new Map(
    ranked.map((ranking) => [ranking.candidateOutputId, ranking]),
  );
  return inputs.map(
    (input) =>
      rankingById.get(input.candidateOutputId) ??
      unranked(
        input.candidateOutputId,
        qualityById.get(input.candidateOutputId)!,
      ),
  );
}

function validateLocation(value: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({
      field: "location",
      code: "invalid_location",
      message: "A location is required.",
    });
    return;
  }

  if (value.kind === "city" && isNonEmptyString(value.city)) {
    return;
  }

  if (
    value.kind === "coordinates" &&
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  ) {
    return;
  }

  issues.push({
    field: "location",
    code: "invalid_location",
    message:
      "Location must be a non-empty city or valid latitude and longitude.",
  });
}

function validateLocalDateTime(
  value: unknown,
  issues: ValidationIssue[],
): void {
  if (!isValidLocalDateTime(value)) {
    issues.push({
      field: "localDateTime",
      code: "invalid_date_time",
      message: "Local date-time must be a valid ISO-8601 local date-time.",
    });
  }
}

function validateControlledValue(
  value: unknown,
  options: readonly ControlledOption<string>[],
  field: string,
  issues: ValidationIssue[],
): void {
  if (!options.some((option) => option.value === value)) {
    issues.push({
      field,
      code: "invalid_option",
      message: `${field} must be a supported option.`,
    });
  }
}

function validateCandidateModelIds(
  value: unknown,
  issues: ValidationIssue[],
): void {
  if (!Array.isArray(value) || value.length < 2 || value.length > 6) {
    issues.push({
      field: "candidateModelIds",
      code: "candidate_model_count",
      message: "Select from two to six candidate models.",
    });
    return;
  }

  if (!value.every(isNonEmptyString)) {
    issues.push({
      field: "candidateModelIds",
      code: "invalid_model_id",
      message: "Candidate model IDs must be non-empty strings.",
    });
  }

  if (new Set(value).size !== value.length) {
    issues.push({
      field: "candidateModelIds",
      code: "duplicate_candidate_model",
      message: "Candidate model selections must be unique.",
    });
  }
}

function isValidLocalDateTime(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

function unranked(
  candidateOutputId: string,
  qualityScore: number,
): CandidateRanking {
  return {
    candidateOutputId,
    status: "unranked",
    qualityScore,
    costScore: null,
    speedScore: null,
    overallValue: null,
    rank: null,
  };
}

function assertPositiveFinite(value: number, label: string): void {
  if (!isPositiveFinite(value)) {
    throw new RangeError(`${label} must be a positive, finite number.`);
  }
}

function assertNormalizedScore(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new RangeError(
      `${label} must be a finite number greater than 0 and no more than 1.`,
    );
  }
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function invalid<T>(
  field: string,
  code: ValidationIssueCode,
  message: string,
): ValidationResult<T> {
  return { ok: false, issues: [{ field, code, message }] };
}
