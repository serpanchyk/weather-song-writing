import type {
  CandidateOutput,
  CreateRunInput,
  WeatherSummary,
} from "@weather-song-writing/contracts";

export interface ChatMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

export interface BlindJudgePrompt {
  readonly messages: readonly ChatMessage[];
  /** Maps anonymous judge labels back to stored candidate output IDs. */
  readonly candidates: readonly {
    readonly label: string;
    readonly candidateOutputId: string;
  }[];
}

export const JUDGE_RESPONSE_JSON_SCHEMA = {
  name: "weather_lyrics_judgement",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["evaluations"],
    properties: {
      evaluations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "candidateLabel",
            "instructionFollowing",
            "lyricalQuality",
            "creativity",
            "weatherRelevance",
          ],
          properties: {
            candidateLabel: { type: "string" },
            instructionFollowing: { $ref: "#/$defs/rubricScore" },
            lyricalQuality: { $ref: "#/$defs/rubricScore" },
            creativity: { $ref: "#/$defs/rubricScore" },
            weatherRelevance: { $ref: "#/$defs/rubricScore" },
          },
        },
      },
    },
    $defs: {
      rubricScore: {
        type: "object",
        additionalProperties: false,
        required: ["score", "reasoning"],
        properties: {
          score: { type: "number", minimum: 0, maximum: 10 },
          reasoning: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const;

export function buildCandidateLyricsPrompt(
  input: CreateRunInput,
  weather: WeatherSummary,
): readonly ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You write original lyrics only. Do not mention being an AI, provide explanations, or reproduce existing lyrics.",
    },
    {
      role: "user",
      content: `${creativeBrief(input, weather)}\n\nWrite the lyrics now.`,
    },
  ];
}

export function buildBlindJudgePrompt(
  input: CreateRunInput,
  weather: WeatherSummary,
  outputs: readonly CandidateOutput[],
): BlindJudgePrompt {
  const successfulOutputs = outputs.filter(
    (output) => output.status === "succeeded" && output.lyrics !== null,
  );
  const candidates = successfulOutputs.map((output, index) => ({
    label: `Candidate ${String.fromCharCode(65 + index)}`,
    candidateOutputId: output.id,
  }));
  const outputText = successfulOutputs
    .map(
      (output, index) =>
        `### ${candidates[index]!.label}\n${output.lyrics!.trim()}`,
    )
    .join("\n\n");

  return {
    messages: [
      {
        role: "system",
        content:
          "You are a strict, blind evaluator of original lyrics. Score each anonymous candidate independently. Return only JSON matching the supplied schema.",
      },
      {
        role: "user",
        content: `${creativeBrief(input, weather)}\n\nEvaluate this anonymous candidate from 0 to 10 for each criterion. Use these anchors: 0 = entirely absent or contradictory; 2 = severely inadequate; 4 = weak and inconsistent; 6 = competent but uneven; 8 = strong and clearly effective; 10 = exceptional and fully satisfies the brief.\n- Instruction following: obeys genre, language, structure, mood, and lyrics-only constraints.\n- Lyrical quality: imagery, flow, coherence, and singable phrasing.\n- Creativity: original, specific writing rather than generic phrases.\n- Weather relevance: weather details are meaningfully woven into the lyrics.\nGive concise evidence-based reasoning for every score.\n\n${outputText}`,
      },
    ],
    candidates,
  };
}

function creativeBrief(input: CreateRunInput, weather: WeatherSummary): string {
  return [
    "Write for this creative brief:",
    `- Genre: ${input.genre}`,
    `- Language: ${input.language}`,
    `- Structure: ${input.lyricsStructure}`,
    `- Mood: ${input.mood}`,
    "- Weather:",
    `  - Location: ${weather.displayLocation}`,
    `  - Local time: ${weather.localDateTime} (${weather.timezone})`,
    `  - Conditions: ${weather.weatherDescription}`,
    `  - Temperature: ${displayNumber(weather.temperatureCelsius, "°C")}`,
    `  - Feels like: ${displayNumber(weather.apparentTemperatureCelsius, "°C")}`,
    `  - Precipitation: ${displayNumber(weather.precipitationMm, " mm")}`,
    `  - Wind speed: ${displayNumber(weather.windSpeedKph, " kph")}`,
  ].join("\n");
}

function displayNumber(value: number | null, suffix: string): string {
  return value === null ? "unavailable" : `${value}${suffix}`;
}
