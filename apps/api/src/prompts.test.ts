import assert from "node:assert/strict";
import test from "node:test";
import type {
  CandidateOutput,
  CreateRunInput,
  WeatherSummary,
} from "@weather-song-writing/contracts";

import {
  buildBlindJudgePrompt,
  buildCandidateLyricsPrompt,
  JUDGE_RESPONSE_JSON_SCHEMA,
} from "./prompts.js";

const input: CreateRunInput = {
  location: { kind: "city", city: "Lviv" },
  localDateTime: "2026-08-25T18:30",
  genre: "indie",
  language: "uk",
  lyricsStructure: "verse-chorus",
  mood: "dreamy",
  candidateModelIds: ["provider/model-a", "provider/model-b"],
};
const weather: WeatherSummary = {
  displayLocation: "Lviv, Ukraine",
  latitude: 49.84,
  longitude: 24.03,
  localDateTime: input.localDateTime,
  timezone: "Europe/Kyiv",
  temperatureCelsius: 19,
  apparentTemperatureCelsius: 18,
  precipitationMm: 0.2,
  windSpeedKph: 10,
  weatherDescription: "Partly cloudy",
};

test("every candidate receives the identical weather and creative prompt", () => {
  const first = buildCandidateLyricsPrompt(input, weather);
  const second = buildCandidateLyricsPrompt(input, weather);

  assert.deepEqual(first, second);
  assert.match(first[1]!.content, /indie/);
  assert.match(first[1]!.content, /Partly cloudy/);
  assert.match(first[1]!.content, /Europe\/Kyiv/);
});

test("judge prompt maps anonymous outputs while omitting identities and metadata", () => {
  const outputs: CandidateOutput[] = [
    candidate("output-a", "provider/private-model-a", "first lyrics", 12, 1.3),
    candidate(
      "output-b",
      "provider/private-model-b",
      "second lyrics",
      900,
      0.02,
    ),
  ];
  const prompt = buildBlindJudgePrompt(input, weather, outputs);
  const serialized = JSON.stringify(prompt.messages);

  assert.deepEqual(prompt.candidates, [
    { label: "Candidate A", candidateOutputId: "output-a" },
    { label: "Candidate B", candidateOutputId: "output-b" },
  ]);
  assert.match(serialized, /Candidate A/);
  assert.doesNotMatch(serialized, /private-model|900|1\.3|0\.02/);
  assert.equal(
    JUDGE_RESPONSE_JSON_SCHEMA.schema.properties.evaluations.items.properties
      .weatherRelevance.$ref,
    "#/$defs/rubricScore",
  );
});

function candidate(
  id: string,
  modelId: string,
  lyrics: string,
  responseTimeMs: number,
  estimatedCostUsd: number,
): CandidateOutput {
  return {
    id,
    modelId,
    status: "succeeded",
    lyrics,
    responseTimeMs,
    estimatedCostUsd,
    errorMessage: null,
  };
}
