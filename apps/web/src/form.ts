import type {
  CreateRunInput,
  ModelCatalogEntry,
} from "@weather-song-writing/contracts";
import {
  GENRE_OPTIONS,
  LANGUAGE_OPTIONS,
  LYRICS_STRUCTURE_OPTIONS,
  MOOD_OPTIONS,
} from "@weather-song-writing/contracts";
export {
  GENRE_OPTIONS,
  LANGUAGE_OPTIONS,
  LYRICS_STRUCTURE_OPTIONS,
  MOOD_OPTIONS,
};
export const DEFAULT_JUDGE_MODEL_ID = "openai/gpt-5.6-luna-pro";
export interface FormValues {
  readonly locationMode: "city" | "coordinates";
  readonly city: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly localDateTime: string;
  readonly genre: string;
  readonly language: string;
  readonly lyricsStructure: string;
  readonly mood: string;
  readonly candidateModelIds: readonly string[];
  readonly judgeModelId: string;
}
export function validateForm(values: FormValues): string[] {
  const errors: string[] = [];
  if (values.locationMode === "city" && !values.city.trim())
    errors.push("Enter a city.");
  if (
    values.locationMode === "coordinates" &&
    (!coordinate(values.latitude, -90, 90) ||
      !coordinate(values.longitude, -180, 180))
  )
    errors.push("Enter valid latitude and longitude.");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(values.localDateTime))
    errors.push("Choose a local date and time.");
  if (
    values.candidateModelIds.length < 2 ||
    values.candidateModelIds.length > 6 ||
    new Set(values.candidateModelIds).size !== values.candidateModelIds.length
  )
    errors.push("Select two to six unique candidate models.");
  if (!values.judgeModelId) errors.push("Choose a judge model.");
  return errors;
}
export function toCreateRunInput(values: FormValues): CreateRunInput {
  return {
    location:
      values.locationMode === "city"
        ? { kind: "city", city: values.city.trim() }
        : {
            kind: "coordinates",
            latitude: Number(values.latitude),
            longitude: Number(values.longitude),
          },
    localDateTime: values.localDateTime,
    genre: values.genre as CreateRunInput["genre"],
    language: values.language as CreateRunInput["language"],
    lyricsStructure:
      values.lyricsStructure as CreateRunInput["lyricsStructure"],
    mood: values.mood as CreateRunInput["mood"],
    candidateModelIds: values.candidateModelIds,
    judgeModelId: values.judgeModelId,
  };
}
export function modelWarning(model: ModelCatalogEntry): string | null {
  return model.pricingStatus === "expensive"
    ? "Higher-cost model"
    : model.pricingStatus === "missing"
      ? "Pricing unavailable"
      : null;
}
function coordinate(value: string, min: number, max: number): boolean {
  const parsed = Number(value);
  return (
    value.trim() !== "" &&
    Number.isFinite(parsed) &&
    parsed >= min &&
    parsed <= max
  );
}
