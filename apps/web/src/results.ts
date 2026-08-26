import type { CandidateJudgeEvaluation, CandidateOutput, CandidateRanking, GenerationRun, RunHistoryPage, RunSummary } from "@weather-song-writing/contracts";

export const RANKING_FORMULA = "Overall value = quality × 0.75 + cost score × 10 × 0.15 + speed score × 10 × 0.10";

export function renderRun(run: GenerationRun): string {
  const rankings = new Map(run.rankings.map((item) => [item.candidateOutputId, item]));
  const evaluations = new Map(run.judgeEvaluations.map((item) => [item.candidateOutputId, item]));
  const winner = run.candidateOutputs.find((output) => output.id === run.topCandidateOutputId);
  return `<section class="result-hero"><p class="eyebrow">${escape(statusLabel(run.status))} comparison</p><h1>${winner ? "A clearer choice for this weather moment" : "This comparison could not be ranked"}</h1><p class="result-intro">${winner ? `Top-rated Lyrics from ${escape(winner.modelId)} after a blind judge evaluation.` : escape(run.errorMessage ?? "Fewer than two Candidate Outputs were available for evaluation.")}</p>${winner ? `<div class="winner-strip"><span>Top Lyrics</span><strong>${escape(winner.modelId)}</strong><span>${metric(rankings.get(winner.id)?.overallValue, "overall value")}</span></div>` : ""}</section>${renderWeather(run)}<section class="formula-card"><div><p class="eyebrow">Transparent scoring</p><h2>How the ranking works</h2></div><p>${escape(RANKING_FORMULA)}</p></section><section class="output-section"><div class="section-heading"><div><p class="eyebrow">Blind evaluation complete</p><h2>Candidate Outputs</h2></div><p>${run.successfulOutputCount} of ${run.candidateOutputs.length} produced Lyrics</p></div><div class="output-list">${run.candidateOutputs.slice().sort((a, b) => (rankings.get(a.id)?.rank ?? 999) - (rankings.get(b.id)?.rank ?? 999)).map((output) => renderOutput(output, rankings.get(output.id), evaluations.get(output.id))).join("")}</div></section>`;
}

export function renderHistory(page: RunHistoryPage, compact = false): string {
  const runs = compact ? page.runs.slice(0, 4) : page.runs;
  return runs.length ? `<div class="history-list">${runs.map(renderHistoryItem).join("")}</div>` : `<div class="empty-state"><h3>No comparisons yet</h3><p>Your completed weather-and-lyrics comparisons will appear here.</p></div>`;
}

function renderWeather(run: GenerationRun): string {
  if (run.weather === null) return "";
  const weather = run.weather;
  return `<section class="weather-card"><div><p class="eyebrow">Weather Input</p><h2>${escape(weather.displayLocation)}</h2><p>${escape(formatTime(weather.localDateTime))} · ${escape(weather.weatherDescription)}</p></div><div class="weather-stats"><span><strong>${weather.temperatureCelsius === null ? "—" : `${weather.temperatureCelsius}°`}</strong>temperature</span><span><strong>${weather.windSpeedKph === null ? "—" : `${weather.windSpeedKph} km/h`}</strong>wind</span><span><strong>${weather.precipitationMm === null ? "—" : `${weather.precipitationMm} mm`}</strong>rain</span></div></section>`;
}

function renderOutput(output: CandidateOutput, ranking: CandidateRanking | undefined, evaluation: CandidateJudgeEvaluation | undefined): string {
  const label = ranking?.rank ? `#${ranking.rank}` : statusLabel(output.status);
  return `<details class="output-card" ${ranking?.rank === 1 ? "open" : ""}><summary><span class="rank-badge">${escape(label)}</span><span class="output-name"><strong>${escape(output.modelId)}</strong><small>${escape(statusLabel(output.status))}</small></span><span class="output-metrics">${ranking ? `<small>Quality <b>${ranking.qualityScore.toFixed(2)}</b></small><small>Value <b>${ranking.overallValue?.toFixed(2) ?? "—"}</b></small>` : "<small>Not ranked</small>"}</span><span class="chevron" aria-hidden="true">⌄</span></summary><div class="output-body">${output.lyrics ? `<pre>${escape(output.lyrics)}</pre>` : `<p class="inline-error">${escape(output.errorMessage ?? "No Lyrics returned.")}</p>`}<div class="metric-grid"><div><span>Quality</span><strong>${ranking?.qualityScore.toFixed(2) ?? "—"}</strong></div><div><span>Estimated cost</span><strong>${currency(output.estimatedCostUsd)}</strong></div><div><span>Response time</span><strong>${output.responseTimeMs === null ? "—" : `${output.responseTimeMs} ms`}</strong></div><div><span>Overall value</span><strong>${ranking?.overallValue?.toFixed(2) ?? "—"}</strong></div></div>${evaluation ? renderRubric(evaluation) : ""}</div></details>`;
}

function renderRubric(evaluation: CandidateJudgeEvaluation): string {
  const entries = [["Instruction following", evaluation.scores.instructionFollowing], ["Lyrical quality", evaluation.scores.lyricalQuality], ["Creativity", evaluation.scores.creativity], ["Weather relevance", evaluation.scores.weatherRelevance]] as const;
  return `<div class="rubric"><h3>Judge notes</h3>${entries.map(([label, score]) => `<div class="rubric-row"><div><strong>${label}</strong><p>${escape(score.reasoning)}</p></div><b>${score.score.toFixed(1)}</b></div>`).join("")}</div>`;
}

function renderHistoryItem(run: RunSummary): string {
  const location = run.input.location.kind === "city" ? run.input.location.city : `${run.input.location.latitude.toFixed(2)}, ${run.input.location.longitude.toFixed(2)}`;
  return `<button class="history-item" data-run-id="${escape(run.id)}"><span class="status-dot status-${escape(run.status)}"></span><span><strong>${escape(location)}</strong><small>${escape(formatTime(run.createdAt))} · ${escape(run.input.genre)} · ${run.successfulOutputCount} outputs</small></span><span aria-hidden="true">→</span></button>`;
}

function currency(value: number | null): string { return value === null ? "—" : `$${value.toFixed(value < 0.01 ? 4 : 2)}`; }
function metric(value: number | null | undefined, label: string): string { return value === null || value === undefined ? "Value unavailable" : `${value.toFixed(2)} ${label}`; }
function statusLabel(status: string): string { return status === "partial" ? "Partial" : status === "timed_out" ? "Timed out" : status[0]!.toUpperCase() + status.slice(1); }
function formatTime(value: string): string { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date); }
export function escape(value: string): string { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!); }
