import type {
  GenerationRun,
  RunHistoryPage,
} from "@weather-song-writing/contracts";

export const RANKING_FORMULA =
  "overall value = quality × 0.75 + cost score × 10 × 0.15 + speed score × 10 × 0.10";

export function renderRun(run: GenerationRun): string {
  const rankings = new Map(
    run.rankings.map((item) => [item.candidateOutputId, item]),
  );
  return `<h2>Run ${run.status}</h2><p>${RANKING_FORMULA}</p>${run.candidateOutputs
    .map((output) => {
      const ranking = rankings.get(output.id);
      return `<article><h3>${ranking?.rank ? `#${ranking.rank} ` : ""}${output.modelId}</h3><p>${output.status} · quality ${ranking?.qualityScore.toFixed(2) ?? "unavailable"} · cost ${output.estimatedCostUsd ?? "unavailable"} · ${output.responseTimeMs ?? "unavailable"} ms</p>${output.lyrics ? `<pre>${output.lyrics}</pre>` : `<p class="error">${output.errorMessage ?? "No lyrics returned."}</p>`}</article>`;
    })
    .join("")}`;
}
export function renderHistory(page: RunHistoryPage): string {
  return `<h2>Previous runs</h2>${page.runs.map((run) => `<button data-run-id="${run.id}">${run.createdAt} — ${run.status}</button>`).join("") || "<p>No saved runs yet.</p>"}`;
}
