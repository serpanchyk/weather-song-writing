# Add Deployment And CI Checks

## Type

AFK

## Context

- [README Open Decisions](../../../README.md#open-decisions)
- [Run Project](../../run-project.md)
- [Agent Guide Testing And Checks](../../../AGENTS.md#testing-and-checks)

## What To Build

Add CI, deployment documentation, and production configuration for GitHub Pages,
Cloudflare Worker, and Cloudflare D1.

## Acceptance Criteria

- [ ] CI runs formatting, linting, typecheck, tests, and build.
- [ ] Frontend build is configured for GitHub Pages.
- [ ] Worker deployment is configured through Wrangler.
- [ ] D1 migrations are documented and runnable.
- [ ] `.env.example` or equivalent config docs list required local and deployed
      variables without real secrets.
- [ ] `docs/run-project.md` explains local development, checks, and deployment.
- [ ] Final smoke checks are documented.

## Blocked By

- [Show ranked results and run history](0010-results-and-history-ui.md)
