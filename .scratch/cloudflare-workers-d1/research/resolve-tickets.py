#!/usr/bin/env python3
"""Resolve the cloudflare-workers-d1 tickets in the local-markdown tracker."""
import re
import pathlib

ISSUES = pathlib.Path('.scratch/cloudflare-workers-d1/issues')
MERGE = {
    '01': 'ed9af32',
    '02': '7338356',
    '03': '7e57c20',
    '04': 'ba2b61f',
    '05': 'b3b5bee',
    '06': '10f89f1',
    '07': 'ab88f32',
    '08': '837a4d3',
    '09': '16a7eae',
    '10': '06b25ec',
    '11': 'f74319f',
    '12': '950147b',
    '13': 'febfe7f',
}
# Human-gated acceptance lines that must stay unchecked (no Cloudflare creds).
HUMAN_GATED = {
    '01': ['wrangler deploy --dry-run passes, the preview deployment'],
    '12': [
        'Production secrets for Scrape Credential encryption are provisioned, preview and production D1 bindings are separated',
        'Observability, bundle inspection, and a preview smoke',
    ],
    '13': [
        'The Worker is deployed to production, the production domain points at it',
        'Final typecheck, lint, tests, build, Wrangler dry-run, and production smoke pass.',
    ],
}
COMMENTS = {
    '01': 'Preview deployment and the production Netlify smoke are human-gated (no Cloudflare credentials in the agent environment). SPA + health + 501 + Worker test harness verified locally and via `wrangler deploy --dry-run`.',
    '02': 'Schema/migration, seed, cascade smoke, app+worker typecheck and repo-wide lint verified locally.',
    '03': 'Auth CPU median ~2 ms in workerd; legacy `salt:hash` vector verifies.',
    '04': 'AES-GCM at rest, write-only responses, Apify save-time validation, treg lazy validation verified by tests.',
    '05': 'Profiles CRUD + both-shape normalization verified by tests; raw_data retained.',
    '06': 'Numeric total, filters, duplicate save, >100-id chunked batch delete verified by tests.',
    '07': 'Admin API/UI quota-free; eight-field user response; singleton registration verified.',
    '08': 'Apify adapter request shape/statuses/dataset + 10-URL cap + preview-to-save verified; bundle has no `apify-client`.',
    '09': 'treg GET-only envelope/tier/idempotency/429/concurrency verified; no server treg token.',
    '10': 'Owner-scoped company jobs, poll/resume, dedupe/truncate, cleanup cron, history and Saved Leads verified.',
    '11': 'treg paged search/dedupe/truncate, 5-per-poll enrichment, incremental items, stats/history verified.',
    '12': 'Decision: Workers Free is sufficient at measured margins (auth ~2 ms, max 15/50 D1 queries, worst-case 26/50 subrequests); preview/prod deploy, secrets and fleet CPU checks remain human-gated.',
    '13': 'Production deploy/domain/smoke are human-gated. Code/docs cleanup, deps, tag and local smoke verified.',
}


def resolve(number: str, path: pathlib.Path) -> None:
    text = path.read_text()
    text = text.replace('**Status:** ready-for-agent', '**Status:** resolved')
    lines = []
    for line in text.splitlines():
        if line.startswith('- [ ]'):
            keep = any(fragment in line for fragment in HUMAN_GATED.get(number, []))
            lines.append('- [ ]' + line[5:] if keep else '- [x]' + line[5:])
        else:
            lines.append(line)
    text = '\n'.join(lines).rstrip() + '\n'
    if '## Comments' not in text:
        text += (
            '\n## Comments\n\n'
            f'Resolved on `feat/cloudflare-workers-d1` (merge `{MERGE[number]}`). '
            'Final gate: typecheck, lint, 154+ tests, build, `wrangler deploy --dry-run`. '
            + COMMENTS[number]
            + '\n'
        )
    path.write_text(text)


for path in sorted(ISSUES.glob('*.md')):
    match = re.match(r'(\d{2})-', path.name)
    if not match or match.group(1) not in MERGE:
        continue
    resolve(match.group(1), path)
    print('resolved', path.name)
