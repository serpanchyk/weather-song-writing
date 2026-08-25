# Run Candidate Generation And Scoring

## Type

AFK

## Context

- [Vision Core Flow](../../VISION.md#core-flow)
- [Vision Final Ranking](../../VISION.md#final-ranking)
- [Vision Failure Handling](../../VISION.md#failure-handling)

## What To Build

Implement the end-to-end Worker route that generates candidate lyrics, evaluates
successful outputs with the judge model, computes ranking, and persists the run.

## Acceptance Criteria

- [ ] Run creation validates input before external calls.
- [ ] Candidate generation calls two to six selected OpenRouter models.
- [ ] Response time is measured per candidate.
- [ ] Estimated cost is computed or marked unavailable from pricing metadata.
- [ ] Judge evaluation runs only if at least two candidate outputs succeed.
- [ ] Failed or timed-out candidates remain visible with error status and are
      excluded from ranking.
- [ ] Ranking uses the documented visible formula.
- [ ] The run is saved to D1 and returned to the frontend.
- [ ] Integration tests cover successful, partial, and failed runs with mocked
      external services.

## Blocked By

- [Add D1 run history storage](0004-d1-run-history-storage.md)
- [Expose OpenRouter model catalog](0005-openrouter-model-catalog.md)
- [Build lyrics generation and judge prompts](0007-prompt-building-and-blind-judge.md)
