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
          score: { type: "integer", minimum: 0, maximum: 10 },
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
        content: `${creativeBrief(input, weather)}

Evaluate this anonymous candidate on a 0–10 scale for each criterion.

General scoring anchors:
- 0–1: Fails the criterion almost completely, contradicts the brief, or shows no meaningful evidence of satisfying it.
- 2–3: Major problems. Some attempt is visible, but the criterion is mostly unsatisfied.
- 4–5: Partially successful. Meets the criterion in places, but has obvious weaknesses, inconsistencies, or generic execution.
- 6–7: Competent. Clearly satisfies the criterion overall, with some noticeable limitations.
- 8–9: Strong. Satisfies the criterion consistently and effectively, with only minor weaknesses.
- 10: Exceptional. Fully satisfies the criterion with unusually strong execution and no meaningful deficiencies.

Score each criterion independently. Do not raise one score simply because another aspect of the song is strong. Use the full 0–10 range when justified.

## 1. Instruction following

Evaluate only how accurately the candidate follows the explicit creative brief.

Check:
- Genre: Does the writing fit the requested genre in vocabulary, rhythm, structure, attitude, and conventions?
- Language: Is the entire song written naturally in the requested language?
- Structure: Does it follow the requested verse/chorus/bridge structure and section ordering?
- Mood: Does the emotional tone consistently match the requested mood?
- Format: Does it obey constraints such as lyrics-only output and avoid explanations, commentary, metadata, or unrelated text?
- Other explicit requirements: Are all requested details and constraints respected?

Scoring guidance:
- 0–2: Ignores or directly contradicts several major instructions.
- 3–4: Follows some requirements but misses multiple important constraints.
- 5–6: Follows most major instructions, but has noticeable deviations.
- 7–8: Follows nearly all instructions correctly, with only minor issues.
- 9: Follows all explicit instructions very accurately.
- 10: Perfect compliance with every explicit constraint, including subtle structural and stylistic requirements.

Do not judge whether the instructions themselves produced a good song here. Judge compliance only.

## 2. Lyrical quality

Evaluate the craft and effectiveness of the lyrics as song lyrics.

Check:
- Imagery: Does the writing create clear, evocative images rather than merely state facts or emotions?
- Flow: Do lines connect naturally and maintain readable lyrical momentum?
- Coherence: Do verses and sections feel connected by a consistent idea, perspective, or emotional progression?
- Singability: Are lines reasonably shaped for musical delivery rather than reading like prose?
- Phrasing: Is the wording natural, deliberate, and rhythmically plausible?
- Repetition: Are repeated phrases or choruses purposeful rather than accidental or monotonous?
- Language quality: Are grammar, word choice, and syntax appropriate for the requested language and style?

Scoring guidance:
- 0–2: Broken, incoherent, highly awkward, or mostly prose-like writing.
- 3–4: Understandable but clumsy, flat, poorly flowing, or structurally weak.
- 5–6: Functional lyrics with some good moments but inconsistent craft.
- 7–8: Strong lyrical writing with good flow, imagery, coherence, and musical phrasing.
- 9: Highly polished lyrics with consistently effective craft and memorable phrasing.
- 10: Exceptional lyrical execution throughout, with virtually no weak or awkward lines.

Do not reward originality here unless it improves the actual lyrical craft; originality is scored separately.

## 3. Creativity

Evaluate how original, specific, and non-generic the writing is.

Check:
- Specificity: Does the song use concrete observations, images, situations, or details rather than vague emotional statements?
- Originality: Are metaphors, comparisons, images, and phrasing fresh rather than predictable?
- Avoidance of clichés: Does it avoid overused phrases and obvious associations unless they are transformed in an interesting way?
- Distinctiveness: Does the song have a recognizable identity rather than sounding interchangeable with generic AI-generated lyrics?
- Creative use of the brief: Does it interpret the provided setting, weather, mood, and genre in an interesting way rather than merely restating them?

Scoring guidance:
- 0–2: Almost entirely generic, cliché-driven, repetitive, or derivative.
- 3–4: Mostly predictable writing with occasional specific or original moments.
- 5–6: Some distinctive ideas, but mixed with substantial generic phrasing.
- 7–8: Consistently specific and inventive, with several memorable creative choices.
- 9: Highly original and distinctive with very little generic language.
- 10: Exceptionally inventive throughout; surprising but appropriate imagery and phrasing make the song strongly memorable.

Do not penalize simple language merely for being simple. Simplicity can still be highly creative if it is precise and distinctive.

## 4. Weather relevance

Evaluate how meaningfully the provided weather conditions are integrated into the song.

Check:
- Accuracy: Does the song avoid contradicting the supplied weather data?
- Coverage: Does it reflect important provided conditions such as precipitation, temperature, wind, clouds, visibility, or time of day when relevant?
- Integration: Are weather details woven naturally into scenes, emotions, actions, or imagery rather than listed mechanically?
- Specificity: Could the lyrics plausibly have been generated specifically for this weather input?
- Narrative/emotional function: Does the weather contribute to atmosphere, meaning, story, or emotion?
- Balance: Is weather sufficiently present without becoming a dry weather report unless the requested style intentionally calls for that?

Scoring guidance:
- 0–2: Weather is absent, substantially contradicted, or irrelevant to the lyrics.
- 3–4: Weather is mentioned superficially, generically, or only once without meaningful integration.
- 5–6: Weather is clearly present and mostly accurate, but integration is straightforward or inconsistent.
- 7–8: Weather is accurately and naturally woven throughout the song and contributes meaningfully to its atmosphere or content.
- 9: Weather details strongly shape the imagery, mood, or narrative while remaining natural and artistically effective.
- 10: Exceptional integration: the song feels uniquely dependent on this exact weather situation and would lose substantial meaning if the weather were changed.

For every criterion:
1. Assign an integer score from 0 to 10.
2. Give concise, evidence-based reasoning referencing specific characteristics of the candidate.
3. Do not mention or speculate about which model generated the candidate.
4. Do not compare the candidate against unspecified other songs or models.
5. Judge only against the provided creative brief and rubric.

Candidate lyrics:

${outputText}`,
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
