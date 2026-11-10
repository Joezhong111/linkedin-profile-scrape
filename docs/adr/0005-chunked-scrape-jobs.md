# Company scrapes run as chunked, owner-scoped jobs; profile scrapes stay synchronous

## Status

accepted

## Context

Treg HarvestAPI calls are synchronous and slow in email mode (p95 about 49 seconds per profile); a company scrape may request up to 100 items. A single request would run for minutes and exceed Workers Free subrequest limits. Apify is asynchronous but needs run ownership.

## Decision

Company scrapes create a `scrape_jobs` row with an owner and provider. The client polls a job endpoint; each poll advances the job by at most 5 profiles for treg, or checks the Apify run once. Results are stored in `scrape_job_items` and returned when the job succeeds; jobs and items are deleted after 7 days by a daily Cron Trigger. Profile scrapes remain synchronous, capped at 10 URLs, with a warning for Full+email. Jobs are owner-scoped; a job ID belonging to another user is rejected.

## Consequences

- Each request stays within Workers Free subrequest limits and does not hold a connection for minutes.
- The frontend polling branch uses an internal job ID, not an Apify run ID.
- `scrape_job_items` consumes D1 storage; the 7-day cleanup bounds it.
- An abandoned treg job leaves a row until cleanup; chunks that never ran are not charged. Apify start fees may already have been incurred.
- Apify jobs record the provider run ID and copy dataset items into `scrape_job_items`.

## Considered Options

- One synchronous request: rejected due to multi-minute duration and Free subrequest limits.
- Cloudflare Queues or Workflows: rejected for now to avoid extra infrastructure and cost.
- Client-side accumulation: rejected because a disconnect loses progress.
