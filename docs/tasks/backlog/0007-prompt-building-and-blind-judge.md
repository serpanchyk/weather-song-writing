# Build Lyrics Generation And Judge Prompts

## Type

AFK

## Context

- [Vision Model Selection Goal](../../VISION.md#model-selection-goal)
- [System Security Boundary](../../system/README.md#security-boundary)
- [Agent Guide Architecture Rules](../../../AGENTS.md#architecture-rules)

## What To Build

Build deterministic prompt construction for candidate lyrics generation and blind
judge evaluation.

## Acceptance Criteria

- [ ] Every selected candidate model receives the same weather and creative input.
- [ ] Candidate prompt includes weather summary, genre, language, lyrics
      structure, and mood.
- [ ] Judge prompt includes weather summary, genre, language, lyrics structure,
      mood, and anonymous candidate outputs.
- [ ] Judge prompt excludes model names, pricing, and response times.
- [ ] Judge output schema captures instruction following, lyrical quality,
      creativity, weather relevance, and short reasoning per score.
- [ ] Tests verify prompt equality across candidates and judge payload blindness.

## Blocked By

- [Define shared contracts and constants](0002-shared-contracts-and-constants.md)
- [Resolve weather input with Open-Meteo](0006-open-meteo-weather-input.md)
