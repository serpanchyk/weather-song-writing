import type {
  CandidateJudgeEvaluation,
  CandidateOutput,
  CandidateRanking,
  CreateRunInput,
  GenerationRun,
  ModelCatalogEntry,
  RunHistoryPage,
} from "@weather-song-writing/contracts";
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
import { escape, renderHistory, renderRun } from "./results.js";

const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
const app = document.querySelector<HTMLDivElement>("#app")!;
let models: ModelCatalogEntry[] = [];
let selected = new Set<string>();
let page: "generate" | "results" | "history" = "generate";
let activeRun: GenerationRun | null = null;
let liveComparison: LiveComparison | null = null;
let history: RunHistoryPage = { runs: [], nextCursor: null };
let historyLoading = false;

interface LiveCandidate {
  readonly modelId: string;
  status:
    | "waiting"
    | "generating"
    | "generated"
    | "judging"
    | "evaluated"
    | "ranked"
    | "failed"
    | "timed_out"
    | "judge_failed";
  output?: CandidateOutput;
  evaluation?: CandidateJudgeEvaluation;
  ranking?: CandidateRanking;
  errorMessage?: string;
}
interface LiveComparison {
  readonly input: CreateRunInput;
  readonly candidates: Map<string, LiveCandidate>;
  currentMessage: string;
  hasError: boolean;
}
void initialize();
async function initialize() {
  render();
  await Promise.all([loadModels(), loadHistory()]);
}
function render() {
  app.innerHTML = `<main class="site-shell"><header class="site-header"><a class="brand" href="#generate" data-nav="generate"><span class="brand-mark">✦</span><span>Weather <em>Lyrics</em></span></a><nav aria-label="Primary"><button class="nav-link ${page === "generate" ? "is-active" : ""}" data-nav="generate">Create</button><button class="nav-link ${page === "history" ? "is-active" : ""}" data-nav="history">History</button></nav></header>${page === "generate" ? generatorView() : page === "results" ? resultsView() : historyView()}</main>`;
  bindEvents();
}
function generatorView() {
  return `<section class="generator-page"><div class="intro"><p class="eyebrow">Weather-informed writing</p><h1>Turn a moment in the sky into <span>Lyrics.</span></h1><p>Give several selected models the same Weather Input, then compare their Candidate Outputs through a blind evaluation.</p><div class="cloud-line" aria-hidden="true">☁ <span></span> ✦</div></div><div class="generator-grid"><form id="run-form" class="generator-card"><div class="form-section"><div class="section-title"><span>01</span><div><h2>Weather Moment</h2><p>Choose where and when the writing begins.</p></div></div><div class="location-switch" role="radiogroup" aria-label="Location input"><label><input type="radio" name="locationMode" value="city" checked> City</label><label><input type="radio" name="locationMode" value="coordinates"> Coordinates</label></div><div id="city-fields" class="form-fields"><label>City<input name="city" value="Lviv" autocomplete="address-level2" placeholder="e.g. Lviv"></label><label>Local date & time<input type="datetime-local" name="localDateTime" required></label></div><div id="coordinate-fields" class="form-fields is-hidden"><label>Latitude<input name="latitude" inputmode="decimal" placeholder="49.84"></label><label>Longitude<input name="longitude" inputmode="decimal" placeholder="24.03"></label><label>Local date & time<input type="datetime-local" name="coordinateDateTime" required></label></div></div><div class="form-section"><div class="section-title"><span>02</span><div><h2>Creative direction</h2><p>Set a shared brief for every model.</p></div></div><div class="form-fields creative-grid">${select("genre", "Genre", GENRE_OPTIONS)}${select("language", "Language", LANGUAGE_OPTIONS)}${select("lyricsStructure", "Structure", LYRICS_STRUCTURE_OPTIONS)}${select("mood", "Mood", MOOD_OPTIONS)}</div></div><div class="form-section"><div class="section-title"><span>03</span><div><h2>Selected Models</h2><p>Choose between 2 and 6 models to compare.</p></div></div><div class="model-controls"><label class="search-field"><span>⌕</span><input id="search" placeholder="Search models or providers" autocomplete="off"></label><span id="selection-count" class="selection-count">${selected.size}/6 selected</span></div><p id="catalog" class="catalog-status">Loading model catalog…</p><div id="candidates" class="model-list"></div><div class="selected-area"><div class="selected-heading"><strong>Selected Models</strong><span>Choose at least two</span></div><div id="selected-models" class="selected-models"></div></div><label class="judge-field">Judge model<select name="judgeModelId" id="judge-model"></select><small class="judge-hint">Choose a capable judge for more reliable quality scores.</small></label><p id="judge-warning" class="warning" role="status"></p></div><p id="errors" class="form-error" role="alert"></p><button class="generate-button" type="submit"><span>Generate & compare</span><span aria-hidden="true">→</span></button><p class="form-footnote">Candidate Outputs are judged anonymously. Model names, price, and response time never enter the quality evaluation.</p></form><aside class="recent-card"><div class="section-heading"><div><p class="eyebrow">Global archive</p><h2>Recent comparisons</h2></div><button class="text-button" data-nav="history">View all</button></div>${historyLoading ? loading("Loading saved runs…") : renderHistory(history, true)}</aside></div></section>`;
}
function resultsView() {
  if (liveComparison !== null) return renderLiveComparison(liveComparison);
  return activeRun === null
    ? `<section class="empty-page"><h1>No comparison selected</h1><p>Create a new one or reopen a saved run.</p><button class="generate-button" data-nav="generate">Create a comparison <span>→</span></button></section>`
    : `<section class="results-page"><div class="result-actions"><button class="back-button" data-nav="generate">← New comparison</button><button class="text-button" data-nav="history">Browse history</button></div>${renderRun(activeRun)}</section>`;
}
function historyView() {
  return `<section class="history-page"><div class="intro compact"><p class="eyebrow">Global archive</p><h1>Every weather moment, <span>revisited.</span></h1><p>Open any completed comparison to inspect its Lyrics, judge evaluation, and value ranking.</p></div><section class="history-card"><div class="section-heading"><div><p class="eyebrow">Newest first</p><h2>Saved comparisons</h2></div><button class="text-button" data-nav="generate">Create new</button></div>${historyLoading ? loading("Loading saved runs…") : renderHistory(history)}${history.nextCursor ? '<button id="load-more" class="secondary-button">Load more comparisons</button>' : ""}</section></section>`;
}
function bindEvents() {
  app.querySelectorAll<HTMLElement>("[data-nav]").forEach((element) =>
    element.addEventListener("click", () => {
      if (element.dataset.nav !== "results") liveComparison = null;
      page = element.dataset.nav as typeof page;
      render();
    }),
  );
  app
    .querySelectorAll<HTMLButtonElement>("[data-run-id]")
    .forEach((button) =>
      button.addEventListener(
        "click",
        () => void openRun(button.dataset.runId!),
      ),
    );
  app
    .querySelector<HTMLButtonElement>("#load-more")
    ?.addEventListener("click", () => void loadHistory(history.nextCursor));
  const form = app.querySelector<HTMLFormElement>("#run-form");
  if (!form) return;
  const date = field<HTMLInputElement>(form, "localDateTime");
  date.value = dateTime();
  field<HTMLInputElement>(form, "coordinateDateTime").value = date.value;
  app
    .querySelector<HTMLInputElement>("#search")!
    .addEventListener("input", renderCandidates);
  form.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.name === "locationMode") toggleLocation(target.value);
    if (target.name === "judgeModelId") renderWarning();
  });
  form.addEventListener("submit", (event) => void submit(event, form));
  renderCandidates();
  renderJudge();
}
async function loadModels() {
  try {
    const response = await fetch(`${base}/api/v1/models?includeExpensive=true`);
    if (!response.ok) throw new Error();
    models = ((await response.json()) as { models: ModelCatalogEntry[] })
      .models;
  } catch {
    models = [];
  }
  if (page === "generate") {
    renderCandidates();
    renderJudge();
  }
}
async function loadHistory(cursor: string | null = null) {
  historyLoading = true;
  render();
  try {
    const response = await fetch(
      `${base}/api/v1/runs?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    if (!response.ok) throw new Error();
    const next = (await response.json()) as RunHistoryPage;
    history = cursor
      ? { runs: [...history.runs, ...next.runs], nextCursor: next.nextCursor }
      : next;
  } catch {
    history = cursor ? history : { runs: [], nextCursor: null };
  }
  historyLoading = false;
  render();
}
function renderCandidates() {
  const list = app.querySelector("#candidates");
  const tray = app.querySelector("#selected-models");
  const catalog = app.querySelector("#catalog");
  if (!list || !tray || !catalog) return;
  if (!models.length) {
    catalog.textContent =
      "Model catalog unavailable. Check the API connection.";
    list.innerHTML = "";
    return;
  }
  const query =
    app.querySelector<HTMLInputElement>("#search")?.value.toLowerCase() ?? "";
  const matches = models.filter((model) =>
    `${model.id} ${model.displayName} ${model.provider ?? ""}`
      .toLowerCase()
      .includes(query),
  );
  catalog.textContent = `${matches.length}${query ? " matching" : " available"} model${matches.length === 1 ? "" : "s"}.`;
  list.innerHTML = matches
    .map(
      (model) =>
        `<label class="model-row ${selected.has(model.id) ? "is-selected" : ""}"><input type="checkbox" value="${escape(model.id)}" ${selected.has(model.id) ? "checked" : ""}><span><strong>${escape(model.displayName)}</strong><small>${escape(model.provider ?? model.id)} · ${escape(price(model))}</small></span>${modelWarning(model) ? `<em>${escape(modelWarning(model)!)}</em>` : ""}</label>`,
    )
    .join("");
  list.querySelectorAll<HTMLInputElement>("input").forEach((input) =>
    input.addEventListener("change", () => {
      if (input.checked && selected.size < 6) selected.add(input.value);
      else selected.delete(input.value);
      renderCandidates();
      renderWarning();
    }),
  );
  tray.innerHTML = selected.size
    ? [...selected]
        .map((id) => {
          const model = models.find((item) => item.id === id);
          return `<button type="button" class="model-chip" data-remove-model="${escape(id)}">${escape(model?.displayName ?? id)} <span aria-label="Remove">×</span></button>`;
        })
        .join("")
    : '<p class="selection-placeholder">Select models from the list above.</p>';
  tray
    .querySelectorAll<HTMLButtonElement>("[data-remove-model]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        selected.delete(button.dataset.removeModel!);
        renderCandidates();
        renderWarning();
      }),
    );
  app.querySelector("#selection-count")!.textContent =
    `${selected.size}/6 selected`;
}
function renderJudge() {
  const selectElement = app.querySelector<HTMLSelectElement>("#judge-model");
  if (!selectElement) return;
  const previous = selectElement.value;
  selectElement.innerHTML = models
    .map(
      (model) =>
        `<option value="${escape(model.id)}">${escape(model.displayName)} — ${escape(price(model))}</option>`,
    )
    .join("");
  selectElement.value = models.some((model) => model.id === previous)
    ? previous
    : models.some((model) => model.id === DEFAULT_JUDGE_MODEL_ID)
      ? DEFAULT_JUDGE_MODEL_ID
      : (models[0]?.id ?? "");
  renderWarning();
}
function renderWarning() {
  const judge = app.querySelector<HTMLSelectElement>("#judge-model");
  const warning = app.querySelector("#judge-warning");
  if (judge && warning)
    warning.textContent = selected.has(judge.value)
      ? "This judge is also selected to write Lyrics. A separate judge reduces possible bias."
      : "";
}
function toggleLocation(mode: string) {
  app
    .querySelector("#city-fields")
    ?.classList.toggle("is-hidden", mode !== "city");
  app
    .querySelector("#coordinate-fields")
    ?.classList.toggle("is-hidden", mode !== "coordinates");
}
async function submit(event: SubmitEvent, form: HTMLFormElement) {
  event.preventDefault();
  const values = valuesFrom(form);
  const errors = validateForm(values);
  const error = app.querySelector("#errors")!;
  error.textContent = errors.join(" ");
  if (errors.length) return;
  const requestInput = toCreateRunInput(values);
  liveComparison = {
    input: requestInput,
    candidates: new Map(
      requestInput.candidateModelIds.map((modelId) => [
        modelId,
        { modelId, status: "waiting" },
      ]),
    ),
    currentMessage: "Preparing this comparison…",
    hasError: false,
  };
  page = "results";
  render();
  try {
    const response = await fetch(`${base}/api/v1/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(requestInput),
    });
    if (!response.ok || response.body === null)
      throw new Error("Generation could not start.");
    const result = await readRunStream(response.body, applyProgress);
    activeRun = result;
    liveComparison = null;
    page = "results";
    void loadHistory();
    render();
  } catch (cause) {
    if (liveComparison !== null) {
      liveComparison.hasError = true;
      liveComparison.currentMessage =
        cause instanceof Error ? cause.message : "Generation failed.";
      render();
    }
  }
}

type RunStreamMessage =
  | { stage: "weather" | "catalog" | "saving" }
  | {
      stage: "candidate_started";
      modelId: string;
    }
  | {
      stage: "candidate_finished";
      output: CandidateOutput;
    }
  | {
      stage: "judge_started";
      judgeModelId: string;
      modelId: string;
    }
  | {
      stage: "judge_finished";
      modelId: string;
      evaluation: CandidateJudgeEvaluation;
    }
  | { stage: "judge_failed"; modelId: string; message: string }
  | { stage: "ranking"; rankings: readonly CandidateRanking[] };

async function readRunStream(
  body: ReadableStream<Uint8Array>,
  onProgress: (message: RunStreamMessage) => void,
): Promise<GenerationRun> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value ?? new Uint8Array(), {
      stream: !chunk.done,
    });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const type = event.match(/^event: (.+)$/m)?.[1];
      const data = event.match(/^data: (.+)$/m)?.[1];
      if (!type || !data) continue;
      const value = JSON.parse(data) as
        GenerationRun | RunStreamMessage | { message: string };
      if (type === "progress") onProgress(value as RunStreamMessage);
      if (type === "complete") return value as GenerationRun;
      if (type === "error")
        throw new Error((value as { message: string }).message);
    }
    if (chunk.done) break;
  }
  throw new Error("Generation stream ended before a result was returned.");
}

function applyProgress(message: RunStreamMessage) {
  if (liveComparison === null) return;
  liveComparison.currentMessage = progressMessage(message);
  switch (message.stage) {
    case "candidate_started":
      liveComparison.candidates.get(message.modelId)!.status = "generating";
      break;
    case "candidate_finished": {
      const candidate = liveComparison.candidates.get(message.output.modelId)!;
      candidate.output = message.output;
      candidate.status =
        message.output.status === "succeeded"
          ? "generated"
          : message.output.status;
      candidate.errorMessage = message.output.errorMessage ?? undefined;
      break;
    }
    case "judge_started":
      liveComparison.candidates.get(message.modelId)!.status = "judging";
      break;
    case "judge_finished":
      liveComparison.candidates.get(message.modelId)!.evaluation =
        message.evaluation;
      break;
    case "judge_failed": {
      const candidate = liveComparison.candidates.get(message.modelId)!;
      candidate.status = "judge_failed";
      candidate.errorMessage = message.message;
      break;
    }
    case "ranking":
      for (const ranking of message.rankings) {
        const candidate = [...liveComparison.candidates.values()].find(
          (item) => item.output?.id === ranking.candidateOutputId,
        );
        if (candidate) {
          candidate.ranking = ranking;
          candidate.status = ranking.rank ? "ranked" : "evaluated";
        }
      }
      break;
  }
  render();
}

function progressMessage(message: RunStreamMessage): string {
  switch (message.stage) {
    case "weather":
      return "Resolving weather for your selected moment…";
    case "catalog":
      return "Checking model pricing for instant cost estimates…";
    case "candidate_started":
      return `${message.modelId} is writing lyrics…`;
    case "candidate_finished":
      return message.output.status === "succeeded"
        ? `${message.output.modelId} finished. Its cost estimate is ready.`
        : `${message.output.modelId} could not generate lyrics: ${message.output.errorMessage ?? "unknown error"}`;
    case "judge_started":
      return `${message.judgeModelId} is reviewing ${message.modelId} for instruction following, lyrical quality, creativity, and weather relevance.`;
    case "judge_finished":
      return `${message.modelId} has received its quality evaluation.`;
    case "judge_failed":
      return `${message.modelId} could not be judged: ${message.message}`;
    case "ranking":
      return "Combining quality, cost, and response-time scores…";
    case "saving":
      return "Saving this comparison to the global history…";
  }
}

function renderLiveComparison(live: LiveComparison): string {
  const completed = [...live.candidates.values()].filter(
    (candidate) => candidate.output !== undefined,
  ).length;
  return `<section class="results-page"><div class="result-actions"><button class="back-button" data-nav="generate">← New comparison</button><button class="text-button" data-nav="history">Browse history</button></div><section class="live-hero"><p class="eyebrow">Live comparison</p><h1>Building your weather lyric comparison</h1><p>${completed} of ${live.candidates.size} models have returned a result.</p></section><section class="activity-window ${live.hasError ? "has-error" : ""}" aria-live="polite"><div><p class="eyebrow">Run activity</p><h2>${live.hasError ? "This run needs attention" : "Current task"}</h2></div><p class="activity-current">${escape(live.currentMessage)}</p></section><section class="output-section"><div class="section-heading"><div><p class="eyebrow">Candidate outputs</p><h2>Live results</h2></div><p>Scores and ranks update as each model is judged.</p></div><div class="output-list">${[...live.candidates.values()].map(renderLiveCandidate).join("")}</div></section></section>`;
}

function renderLiveCandidate(candidate: LiveCandidate): string {
  const model = models.find((item) => item.id === candidate.modelId);
  const displayName = model?.displayName ?? candidate.modelId;
  const state = candidate.status;
  const status = liveStatusLabel(state, candidate.ranking?.rank);
  const output = candidate.output;
  const quality = candidate.ranking?.qualityScore;
  return `<article class="output-card live-output-card output-card--${escape(liveVisualState(state))}"><header><div class="output-name"><strong>${escape(displayName)}</strong><small>${escape(status)}</small></div><div class="output-metrics">${quality === undefined ? "<small>Awaiting quality score</small>" : `<small>Quality <b>${quality.toFixed(2)}</b></small><small>Value <b>${candidate.ranking?.overallValue?.toFixed(2) ?? "—"}</b></small>`}</div></header><div class="output-body">${output?.lyrics ? `<pre>${escape(output.lyrics)}</pre>` : candidate.errorMessage ? `<p class="inline-error">${escape(candidate.errorMessage)}</p>` : `<p class="live-placeholder">${escape(livePlaceholder(state))}</p>`}${output ? `<div class="metric-grid"><div><span>Estimated cost</span><strong>${output.estimatedCostUsd === null ? "—" : `$${output.estimatedCostUsd.toFixed(4)}`}</strong></div><div><span>Response time</span><strong>${output.responseTimeMs === null ? "—" : `${output.responseTimeMs} ms`}</strong></div><div><span>Quality</span><strong>${quality?.toFixed(2) ?? "Awaiting"}</strong></div><div><span>Rank</span><strong>${candidate.ranking?.rank ? `#${candidate.ranking.rank}` : "Provisional"}</strong></div></div>` : ""}</div></article>`;
}

function liveStatusLabel(
  status: LiveCandidate["status"],
  rank?: number | null,
): string {
  if (rank) return `Ranked #${rank}`;
  return {
    waiting: "Waiting to start",
    generating: "Writing lyrics",
    generated: "Lyrics generated",
    judging: "Blind judge is evaluating",
    evaluated: "Evaluated — value unavailable",
    ranked: "Ranked",
    failed: "Generation failed",
    timed_out: "Generation timed out",
    judge_failed: "Judge evaluation failed",
  }[status];
}

function liveVisualState(status: LiveCandidate["status"]): string {
  return status === "failed" ||
    status === "timed_out" ||
    status === "judge_failed"
    ? "error"
    : status === "ranked"
      ? "ranked"
      : "generated";
}

function livePlaceholder(status: LiveCandidate["status"]): string {
  return {
    waiting: "Waiting for this model to start.",
    generating: "This model is writing lyrics now.",
    generated: "Lyrics are ready; waiting for blind evaluation.",
    judging: "The blind judge is scoring this lyric now.",
    evaluated:
      "Quality is ready; a value rank needs pricing and response-time data.",
    ranked: "Ranking is being updated.",
    failed: "This model could not generate lyrics.",
    timed_out: "This model did not respond before the timeout.",
    judge_failed:
      "The lyrics were generated but the judge could not score them.",
  }[status];
}

async function openRun(id: string) {
  page = "results";
  render();
  try {
    const response = await fetch(
      `${base}/api/v1/runs/${encodeURIComponent(id)}`,
    );
    const result = (await response.json()) as
      GenerationRun | { error?: { message?: string } };
    if (!response.ok || !("candidateOutputs" in result)) throw new Error();
    activeRun = result;
  } catch {
    activeRun = null;
  }
  render();
}
function valuesFrom(form: HTMLFormElement): FormValues {
  const mode = field<HTMLInputElement>(form, "locationMode", true).value as
    "city" | "coordinates";
  return {
    locationMode: mode,
    city: field<HTMLInputElement>(form, "city").value,
    latitude: field<HTMLInputElement>(form, "latitude").value,
    longitude: field<HTMLInputElement>(form, "longitude").value,
    localDateTime: (mode === "city"
      ? field<HTMLInputElement>(form, "localDateTime")
      : field<HTMLInputElement>(form, "coordinateDateTime")
    ).value,
    genre: field<HTMLSelectElement>(form, "genre").value,
    language: field<HTMLSelectElement>(form, "language").value,
    lyricsStructure: field<HTMLSelectElement>(form, "lyricsStructure").value,
    mood: field<HTMLSelectElement>(form, "mood").value,
    candidateModelIds: [...selected],
    judgeModelId: field<HTMLSelectElement>(form, "judgeModelId").value,
  };
}
function field<T extends HTMLInputElement | HTMLSelectElement>(
  form: HTMLFormElement,
  name: string,
  checked = false,
): T {
  return form.querySelector<T>(
    checked ? `[name="${name}"]:checked` : `[name="${name}"]`,
  )!;
}
function select(
  name: string,
  label: string,
  values: readonly { value: string; label: string }[],
) {
  return `<label>${label}<select name="${name}">${values.map((value) => `<option value="${value.value}">${value.label}</option>`).join("")}</select></label>`;
}
function price(model: ModelCatalogEntry) {
  if (
    model.pricing === null ||
    model.pricing.promptUsdPerMillionTokens === null ||
    model.pricing.completionUsdPerMillionTokens === null
  )
    return "pricing unavailable";
  return `$${formatPrice(model.pricing.promptUsdPerMillionTokens)}/$${formatPrice(model.pricing.completionUsdPerMillionTokens)} / 1M`;
}
function formatPrice(value: number) {
  return (Math.round((value + Number.EPSILON) * 100) / 100).toLocaleString(
    "en-US",
    { maximumFractionDigits: 2 },
  );
}
function dateTime() {
  const value = new Date();
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
}
function loading(message: string) {
  return `<div class="loading"><span class="spinner"></span>${message}</div>`;
}
