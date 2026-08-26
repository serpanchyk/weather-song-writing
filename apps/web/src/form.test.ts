import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_JUDGE_MODEL_ID, validateForm } from "./form.js";
const valid = {
  locationMode: "city" as const,
  city: "Lviv",
  latitude: "",
  longitude: "",
  localDateTime: "2026-08-25T18:30",
  genre: "pop",
  language: "en",
  lyricsStructure: "verse-chorus",
  mood: "joyful",
  candidateModelIds: ["a", "b"],
  judgeModelId: "judge",
};
test("validates location and candidate model count", () => {
  assert.deepEqual(validateForm(valid), []);
  assert.match(
    validateForm({ ...valid, city: "", candidateModelIds: ["a", "a"] }).join(
      " ",
    ),
    /city.*unique/i,
  );
});

test("defaults to GPT-5.6 Luna Pro as the judge", () => {
  assert.equal(DEFAULT_JUDGE_MODEL_ID, "openai/gpt-5.6-luna-pro");
});
