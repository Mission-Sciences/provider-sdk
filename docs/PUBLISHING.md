# Publishing @mission_sciences/provider-sdk (scrub-and-mirror)

This Bitbucket repository is the **canonical** source of the SDK. The public
npm package is published from the GitHub mirror
([Mission-Sciences/provider-sdk](https://github.com/Mission-Sciences/provider-sdk))
by its GitHub Actions workflow (`.github/workflows/publish-package.yml`),
which runs on every push to the mirror's `main` branch and publishes to AWS
CodeArtifact (private) and the public npm registry (OIDC trusted publishing —
no npm token).

```
Bitbucket main (canonical)
        │  scripts/publish-mirror.sh --push
        ▼
scrubbed fresh-history snapshot ──force-push──▶ GitHub mirror main
                                                      │  GitHub Actions
                                                      ▼
                                       CodeArtifact + npm registry
```

## Release steps

1. Merge all changes to Bitbucket `main` via PR and bump the `package.json`
   version in the release PR.
2. From a clean, up-to-date checkout of `main`, dry-run the mirror script
   (builds and verifies the snapshot without pushing):

   ```bash
   ./scripts/publish-mirror.sh
   ```

3. Push the scrubbed snapshot to the mirror (this **is** the deploy — the
   push triggers the publish workflow):

   ```bash
   ./scripts/publish-mirror.sh --push
   ```

4. Watch the workflow at
   <https://github.com/Mission-Sciences/provider-sdk/actions> and verify:

   ```bash
   npm view @mission_sciences/provider-sdk version
   ```

## What the scrub does

`scripts/publish-mirror.sh`:

- Snapshots `HEAD` with `git archive` (tracked files only — no git history).
- Removes internal-only paths: Concourse CI config, Terraform, planning docs,
  Claude/agent tooling, internal test/validation docs.
- **Hard-fails** if the snapshot contains any API-key-shaped string
  (`gwsk_` followed by hex) or any pattern from `.internal-patterns.txt`
  (the same list `scripts/scan-tarball.sh` enforces on the npm tarball).
- Commits the snapshot as a single fresh-history commit and force-pushes it
  to the mirror's `main`.

## Rules

- **Never push to the GitHub mirror by hand.** Only the scrubbed snapshot
  from `publish-mirror.sh` may reach the mirror — canonical history and
  internal references must not leak.
- **Never commit real API keys** (`gwsk_<64 hex>`) anywhere, including
  examples. Use the `YOUR_API_KEY` placeholder. Test mocks must use non-hex
  suffixes (e.g. `gwsk_testmockkey`) so the key gate stays zero-tolerance.
- If the mirror and Bitbucket ever diverge (fixes landed mirror-side), port
  the behavior back into Bitbucket with tests first, then re-mirror —
  Bitbucket remains the single source of truth.
