import assert from "node:assert/strict";
import test from "node:test";
import { validateForm } from "./form.js";
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
