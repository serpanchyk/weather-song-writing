# Tasks

This folder breaks the implementation work into ordered tasks. Each task should
be completed and committed before starting the next one.

## Context

- [README](../../README.md): project overview, runtime, service map, and open
  decisions.
- [Vision](../VISION.md): product flow, inputs, scoring, run history, and failure
  behavior.
- [System Overview](../system/README.md): service responsibilities and security
  boundary.
- [Glossary](../../CONTEXT.md): product language.

## Backlog Order

1. [Create TypeScript workspace foundation](backlog/0001-typescript-workspace-foundation.md)
2. [Define shared contracts and constants](backlog/0002-shared-contracts-and-constants.md)
3. [Create Worker API skeleton](backlog/0003-worker-api-skeleton.md)
4. [Add D1 run history storage](backlog/0004-d1-run-history-storage.md)
5. [Expose OpenRouter model catalog](backlog/0005-openrouter-model-catalog.md)
6. [Resolve weather input with Open-Meteo](backlog/0006-open-meteo-weather-input.md)
7. [Build lyrics generation and judge prompts](backlog/0007-prompt-building-and-blind-judge.md)
8. [Run candidate generation and scoring](backlog/0008-generation-scoring-pipeline.md)
9. [Create frontend input flow](backlog/0009-frontend-input-flow.md)
10. [Show ranked results and run history](backlog/0010-results-and-history-ui.md)
11. [Add deployment and CI checks](backlog/0011-deployment-and-ci.md)

## Done Criteria

- The task acceptance criteria are met.
- Relevant tests or checks run successfully, or skipped checks are explained.
- Relevant docs are updated.
- The task is committed before moving to the next task.
