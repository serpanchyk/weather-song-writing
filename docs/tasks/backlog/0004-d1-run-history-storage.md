# Add D1 Run History Storage

## Type

AFK

## Context

- [Vision Run History](../../VISION.md#run-history)
- [System Data Sources](../../system/README.md#data-sources)
- [README Runtime Decisions](../../../README.md#runtime-decisions)

## What To Build

Add Cloudflare D1 schema, migrations, repository code, and API routes for global
run history.

## Acceptance Criteria

- [x] D1 schema stores run input, weather summary, candidate outputs, judge
      scores, cost estimates, response times, ranking, status, and errors.
- [x] Completed and partial runs can be saved.
- [x] Failed runs with fewer than two successful candidates can be recorded with
      failed status.
- [x] API can list recent global runs newest-first.
- [x] API can fetch one run by ID.
- [x] Tests cover save, list, detail, partial run, and failed run behavior.

## Blocked By

- [Create Worker API skeleton](0003-worker-api-skeleton.md)
