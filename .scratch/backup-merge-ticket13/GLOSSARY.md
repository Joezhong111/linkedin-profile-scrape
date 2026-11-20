# LinkedIn Insights Pro

A web app that captures LinkedIn people data through external scrape providers and lets each signed-in user save the people they select.

## Language

### Access and identity

**User**:
A person with an account who owns saved profiles, saved leads, and usage.
_Avoid_: account, member

**Admin**:
A user with the admin role, allowed to manage users, registration settings, and quotas.
_Avoid_: superuser, owner

**Session Token**:
An opaque bearer credential issued at sign-in, stored server-side, revocable, and expiring after 30 days.
_Avoid_: JWT, access token

**Owner Scope**:
The rule that saved records and usage belong to exactly one user and are invisible to other non-admin users.
_Avoid_: tenant isolation, row-level security

### Scraping

**Profile**:
A person captured from one or more LinkedIn profile URLs.
_Avoid_: contact, person

**Lead**:
A person discovered by searching the employees of a company.
_Avoid_: profile, contact

**Scrape Result**:
A person record returned by a scrape run, before the user saves it.
_Avoid_: lead, profile

**Saved Profile**:
A profile the user selected and retained in their account.
_Avoid_: result, record

**Saved Lead**:
A lead the user selected and retained in their account.
_Avoid_: result, record

**Scrape Run**:
A single invocation of a scrape provider for a profile set or a company search page.
_Avoid_: job, task

**Scrape Job**:
An app-tracked company scrape made of one or more scrape runs and processed across multiple requests.
_Avoid_: run, task

**Scrape Provider**:
An external service that performs scrapes on the app's behalf; the app supports Apify and treg.
_Avoid_: actor, vendor

**Active Provider**:
The scrape provider whose credential the user has configured and selected for their scrapes.
_Avoid_: default provider

**Scrape Credential**:
A user-supplied API key for the active scrape provider, stored encrypted and used only for that user's scrapes.
_Avoid_: provider token, API key
