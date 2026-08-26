import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCostScore,
  calculateOverallValue,
  calculateQualityScore,
  calculateSpeedScore,
  rankCandidateOutputs,
  type CreateRunInput,
  type JudgeScores,
  validateCreateRunInput,
} from "./index.js";

const validInput: CreateRunInput = {
  location: { kind: "city", city: "Lviv" },
  localDateTime: "2026-08-25T18:30",
  genre: "indie",
  language: "uk",
  lyricsStructure: "verse-chorus",
  mood: "dreamy",
  candidateModelIds: ["provider/first", "provider/second"],
};

const scores = (value: number): JudgeScores => ({
  instructionFollowing: { score: value, reasoning: "follows instructions" },
  lyricalQuality: { score: value, reasoning: "lyrical" },
  creativity: { score: value, reasoning: "creative" },
  weatherRelevance: { score: value, reasoning: "weather-aware" },
});

test("validates a complete run input", () => {
  const result = validateCreateRunInput(validInput);
  assert.equal(result.ok, true);
});

test("requires two to six unique candidate model IDs", () => {
  for (const candidateModelIds of [
    ["one"],
    ["1", "2", "3", "4", "5", "6", "7"],
    ["one", "one"],
  ]) {
    const result = validateCreateRunInput({ ...validInput, candidateModelIds });
    assert.equal(result.ok, false);
  }
});

test("rejects invalid controlled values, locations, and local date-times", () => {
  const result = validateCreateRunInput({
    ...validInput,
    genre: "opera",
    location: { kind: "coordinates", latitude: 91, longitude: 24 },
    localDateTime: "2026-02-30T12:00",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.issues.map((issue) => issue.field),
      ["location", "localDateTime", "genre"],
    );
  }
});

test("calculates quality and weighted value according to the visible formula", () => {
  assert.equal(calculateQualityScore(scores(8)), 8);
  assert.equal(calculateCostScore(0.01, 0.02), 0.5);
  assert.equal(calculateSpeedScore(100, 200), 0.5);
  assert.equal(calculateOverallValue(8, 0.5, 0.5), 7.25);
});

test("rejects invalid scoring values", () => {
  assert.throws(() => calculateQualityScore(scores(10.1)), RangeError);
  assert.throws(() => calculateCostScore(0, 0.01), RangeError);
  assert.throws(() => calculateSpeedScore(100, 0), RangeError);
  assert.throws(() => calculateOverallValue(8, 0, 1), RangeError);
});

test("ranks eligible outputs and leaves unavailable pricing unranked", () => {
  const rankings = rankCandidateOutputs([
    {
      candidateOutputId: "first",
      scores: scores(8),
      estimatedCostUsd: 0.02,
      responseTimeMs: 200,
    },
    {
      candidateOutputId: "second",
      scores: scores(8),
      estimatedCostUsd: 0.01,
      responseTimeMs: 100,
    },
    {
      candidateOutputId: "third",
      scores: scores(10),
      estimatedCostUsd: null,
      responseTimeMs: 50,
    },
  ]);

  assert.deepEqual(rankings, [
    {
      candidateOutputId: "first",
      status: "ranked",
      qualityScore: 8,
      costScore: 0.5,
      speedScore: 0.5,
      overallValue: 7.25,
      rank: 2,
    },
    {
      candidateOutputId: "second",
      status: "ranked",
      qualityScore: 8,
      costScore: 1,
      speedScore: 1,
      overallValue: 8.5,
      rank: 1,
    },
    {
      candidateOutputId: "third",
      status: "unranked",
      qualityScore: 10,
      costScore: null,
      speedScore: null,
      overallValue: null,
      rank: null,
    },
  ]);
});

test("assigns tied outputs the same rank", () => {
  const rankings = rankCandidateOutputs([
    {
      candidateOutputId: "first",
      scores: scores(8),
      estimatedCostUsd: 0.01,
      responseTimeMs: 100,
    },
    {
      candidateOutputId: "second",
      scores: scores(8),
      estimatedCostUsd: 0.01,
      responseTimeMs: 100,
    },
  ]);

  assert.deepEqual(
    rankings.map((ranking) => ranking.rank),
    [1, 1],
  );
});
