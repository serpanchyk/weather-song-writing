# Create TypeScript Workspace Foundation

## Type

AFK

## Context

- [README](../../../README.md#intended-runtime)
- [Agent Guide](../../../AGENTS.md#repository-boundaries)
- [Run Project](../../run-project.md)

## What To Build

Create the minimal TypeScript workspace needed for a static Vite frontend and a
Cloudflare Worker API. Replace scaffold-only placeholders with real package
metadata and runnable scripts.

## Acceptance Criteria

- [ ] Root package metadata defines workspace scripts for install, dev, build,
      test, typecheck, lint, and format.
- [ ] `apps/web` has a minimal Vite TypeScript app entrypoint.
- [ ] `apps/api` has a minimal Cloudflare Worker TypeScript entrypoint.
- [ ] Real secrets are ignored; example environment files document required
      variables.
- [ ] Local run instructions in `docs/run-project.md` match the implemented
      scripts.

## Blocked By

None - can start immediately.
