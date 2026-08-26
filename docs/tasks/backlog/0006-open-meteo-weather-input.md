# Resolve Weather Input With Open-Meteo

## Type

AFK

## Context

- [Vision Weather Date Handling](../../VISION.md#weather-date-handling)
- [System Data Sources](../../system/README.md#data-sources)
- [Glossary Weather Input](../../../CONTEXT.md)

## What To Build

Resolve city or coordinate input into weather conditions for the selected local
date/time using Open-Meteo geocoding, forecast, and archive APIs.

## Acceptance Criteria

- [ ] City input can resolve to coordinates and a display location.
- [ ] Coordinate input can be accepted directly.
- [ ] Past dates use archive weather data.
- [ ] Today and near-future dates use forecast weather data.
- [ ] Unsupported dates fail validation before generation.
- [ ] Weather summary is normalized for prompt and judge use.
- [ ] Tests cover city resolution, coordinates, archive/forecast branch
      selection, and unsupported date errors.

## Blocked By

- [Define shared contracts and constants](0002-shared-contracts-and-constants.md)
- [Create Worker API skeleton](0003-worker-api-skeleton.md)
