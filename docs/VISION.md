# Vision

## Product Goal

Build a small demo where a user can choose a city, local date/time, and several
OpenRouter models, then receive weather-inspired lyrics and a transparent model
selection result.

## User Experience

The user should be able to:

- select a city and local date/time
- choose two to six OpenRouter models from the full available model catalog
- choose lyrics genre, language, structure, and mood
- optionally change the judge model while seeing the default recommendation
- generate comparable lyrics from the same weather input
- inspect anonymous candidate outputs and rubric scores
- see ranked lyrics alongside quality, cost, latency, and value estimates
- open previous generation runs without requiring user accounts

## Model Selection Goal

The project is not just a lyric generator. It should demonstrate a practical
evaluation loop:

- same input for every model
- blind evaluation so the judge model does not receive model identities
- a recommended default judge model, with an option for the user to choose a
  different judge model
- multiple LLM-as-a-judge evaluations for instruction following, lyrical
  quality, creativity, and weather relevance
- estimated API cost and response time included in the final result

## Core Flow

1. The user selects a location, local date/time, genre, language, lyrics
   structure, mood, two to six OpenRouter models, and optionally a judge model.
2. The app resolves weather conditions for that moment.
3. Each selected model receives the same lyrics prompt, including the selected
   weather input, genre, language, lyrics structure, and mood.
4. The app keeps candidate outputs anonymous during judge evaluation.
5. A judge model scores each candidate output across several evaluation
   dimensions.
6. The final result reveals model names, ranked lyrics, scores, estimated costs,
   response times, and the top-rated output after evaluation is complete.
7. The app saves the run so it can be reopened from the UI later.

## Input Controls

- Location should support city input and coordinates.
- Genre, language, lyrics structure, and mood should be dropdowns, not free-text
  fields.
- Initial genre options can include pop, rock, indie, rap, jazz, folk, and
  electronic.
- Initial language options can include English, Ukrainian, Spanish, French,
  German, and Polish.
- Initial lyrics structure options should include verse-chorus,
  verse-chorus-verse-chorus, verse-chorus-verse-chorus-bridge-chorus, and
  free-form.
- Initial mood options can include melancholic, joyful, dreamy, energetic, dark,
  and romantic.
- Candidate model and judge model selectors should use the same OpenRouter model
  catalog interface.
- The judge model selector should default to GPT-5.6 Luna Pro while still
  allowing the user to choose another available model.
- Model selectors should expose a searchable OpenRouter catalog filtered to
  chat/text models by default, without a display-count cap.
- The app should show clearly rounded pricing metadata before generation when
  available.
- The app should warn about very expensive models, models with missing pricing,
  and cases where the judge model is also one of the selected candidate models.
- The app should prevent duplicate candidate model selections.

## Final Ranking

The final ranking formula should be visible to users.

```text
quality = average(
  instruction_following,
  lyrical_quality,
  creativity,
  weather_relevance
)

cost_score = cheapest_candidate_cost / candidate_cost
speed_score = fastest_candidate_time / candidate_time

overall_value =
  quality * 0.75 +
  cost_score * 10 * 0.15 +
  speed_score * 10 * 0.10
```

Quality should remain the dominant factor, while cost and response time should
help distinguish outputs with similar judge scores.

## Run History

- Every completed run should be saved.
- The UI should let users browse and reopen previous runs from one global
  history.
- Runs do not need to be separated by user account.
- The frontend should provide a recent-runs panel from the generator and a
  paginated history view for older saved runs.

## Failure Handling

- If at least two candidate models succeed, the app should save and rank the
  partial run.
- Failed or timed-out candidate models should appear in the result table with an
  error status and be excluded from ranking.
- If fewer than two candidate models succeed, the app should mark the run failed
  and skip judge evaluation.

## Weather Date Handling

- Past dates should use available archive weather data.
- Today and near-future dates should use forecast weather data.
- Dates outside the supported weather-data range should show a validation error
  before generation.

## Constraints

- Keep the frontend static for GitHub Pages.
- Keep API keys out of browser code.
- Persist run history with a small SQLite-compatible database.
- Prefer free or low-cost services.
- Keep architecture small enough for a test-task demo.
