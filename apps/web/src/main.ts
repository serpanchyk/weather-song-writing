import type { ModelCatalogEntry } from "@weather-song-writing/contracts";
import "./styles.css";
import {
  DEFAULT_JUDGE_MODEL_ID,
  GENRE_OPTIONS,
  LANGUAGE_OPTIONS,
  LYRICS_STRUCTURE_OPTIONS,
  MOOD_OPTIONS,
  modelWarning,
  toCreateRunInput,
  validateForm,
  type FormValues,
} from "./form.js";
import { renderRun } from "./results.js";
const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
const app = document.querySelector<HTMLDivElement>("#app")!;
let models: ModelCatalogEntry[] = [];
app.innerHTML = `<main><h1>Weather Song Writing</h1><p>Compare weather-inspired lyrics from multiple models.</p><form id="run-form"><fieldset><legend>Weather</legend><label><input type="radio" name="locationMode" value="city" checked> City</label><label><input type="radio" name="locationMode" value="coordinates"> Coordinates</label><label>City <input name="city" value="Lviv"></label><label>Latitude <input name="latitude" inputmode="decimal"></label><label>Longitude <input name="longitude" inputmode="decimal"></label><label>Local date/time <input type="datetime-local" name="localDateTime" required></label></fieldset><fieldset><legend>Creative controls</legend>${select("genre", GENRE_OPTIONS)}${select("language", LANGUAGE_OPTIONS)}${select("lyricsStructure", LYRICS_STRUCTURE_OPTIONS)}${select("mood", MOOD_OPTIONS)}</fieldset><fieldset><legend>Models</legend><p id="catalog">Loading catalog…</p><label>Search <input id="search"></label><div id="candidates"></div><label>Judge <select name="judgeModelId"></select></label><p id="judge-warning" class="warning"></p></fieldset><p id="errors" class="error"></p><button>Generate and compare</button></form><section id="result" aria-live="polite"></section></main>`;
const form = app.querySelector<HTMLFormElement>("form")!;
form.localDateTime.value = datetime();
app
  .querySelector<HTMLInputElement>("#search")!
  .addEventListener("input", candidates);
form.addEventListener("change", warning);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = value();
  const errors = validateForm(values);
  app.querySelector("#errors")!.textContent = errors.join(" ");
  if (errors.length) return;
  const result = app.querySelector("#result")!;
  result.textContent = "Generating and anonymously judging lyrics…";
  try {
    const response = await fetch(`${base}/api/v1/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toCreateRunInput(values)),
    });
    const run = await response.json();
    if (!response.ok) throw new Error(run.error?.message);
    window.dispatchEvent(
      new CustomEvent("weather-run-created", { detail: run }),
    );
    result.innerHTML = renderRun(run);
  } catch (error) {
    result.textContent =
      error instanceof Error ? error.message : "Generation failed.";
  }
});
void load();
async function load() {
  try {
    const response = await fetch(`${base}/api/v1/models?includeExpensive=true`);
    models = ((await response.json()) as { models: ModelCatalogEntry[] })
      .models;
    candidates();
    const judge = form.judgeModelId;
    judge.innerHTML = models
      .map(
        (m) =>
          `<option value="${m.id}">${m.displayName} (${price(m)})</option>`,
      )
      .join("");
    judge.value = models.some((m) => m.id === DEFAULT_JUDGE_MODEL_ID)
      ? DEFAULT_JUDGE_MODEL_ID
      : (models[0]?.id ?? "");
    app.querySelector("#catalog")!.textContent =
      `${models.length} models available.`;
    warning();
  } catch {
    app.querySelector("#catalog")!.textContent =
      "Model catalog unavailable. Check API connection.";
  }
}
function candidates() {
  const selected = chosen();
  const query = app
    .querySelector<HTMLInputElement>("#search")!
    .value.toLowerCase();
  app.querySelector("#candidates")!.innerHTML = models
    .filter((m) => `${m.id} ${m.displayName}`.toLowerCase().includes(query))
    .slice(0, 80)
    .map(
      (m) =>
        `<label class="model"><input type="checkbox" name="candidate" value="${m.id}" ${selected.includes(m.id) ? "checked" : ""}> ${m.displayName} <small>${price(m)}${modelWarning(m) ? ` · ${modelWarning(m)}` : ""}</small></label>`,
    )
    .join("");
  app
    .querySelectorAll<HTMLInputElement>('input[name="candidate"]')
    .forEach((input) =>
      input.addEventListener("change", () => {
        if (chosen().length > 6) input.checked = false;
        warning();
      }),
    );
}
function value(): FormValues {
  return {
    locationMode: form.locationMode.value as "city" | "coordinates",
    city: form.city.value,
    latitude: form.latitude.value,
    longitude: form.longitude.value,
    localDateTime: form.localDateTime.value,
    genre: form.genre.value,
    language: form.language.value,
    lyricsStructure: form.lyricsStructure.value,
    mood: form.mood.value,
    candidateModelIds: chosen(),
    judgeModelId: form.judgeModelId.value,
  };
}
function chosen() {
  return Array.from(
    app.querySelectorAll<HTMLInputElement>('input[name="candidate"]:checked'),
    (input) => input.value,
  );
}
function warning() {
  app.querySelector("#judge-warning")!.textContent = chosen().includes(
    form.judgeModelId.value,
  )
    ? "Judge is also a candidate; choose a separate judge to reduce bias."
    : "";
}
function select(
  name: string,
  values: readonly { value: string; label: string }[],
) {
  return `<label>${name} <select name="${name}">${values.map((v) => `<option value="${v.value}">${v.label}</option>`).join("")}</select></label>`;
}
function price(model: ModelCatalogEntry) {
  return model.pricing === null
    ? "pricing unavailable"
    : `$${model.pricing.promptUsdPerMillionTokens}/$${model.pricing.completionUsdPerMillionTokens} per 1M`;
}
function datetime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
