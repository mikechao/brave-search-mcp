# Enforce the Docker build lockfile for `brave-search-mcp`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the repo root. This document must be maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

The Docker image for `apps/brave-search-mcp` should install the exact dependency graph already committed in `pnpm-lock.yaml`. Today it does not. The production image recipe in `apps/brave-search-mcp/Dockerfile` runs `pnpm install --no-frozen-lockfile`, which permits pnpm to resolve a different dependency graph during image build time. That means two people can rebuild the same commit on different days and get different container contents even though source control did not change.

After this change, the Docker build will fail fast if the lockfile and workspace manifests drift out of sync, and a regression test will protect that contract. A user can see the improvement by running the Docker build and observing that the install layer now uses `--frozen-lockfile`, while the new test fails before the Dockerfile edit and passes after it.

## Progress

- [x] (2026-03-09 19:23Z) Inspected `apps/brave-search-mcp/Dockerfile`, `apps/brave-search-mcp/README.md`, and `pnpm-lock.yaml` to identify the Docker-specific defect.
- [x] (2026-03-09 19:23Z) Built the current Docker image successfully and confirmed the install step uses `pnpm install --no-frozen-lockfile`.
- [x] (2026-03-09 19:23Z) Verified inside the built image that `pnpm install --frozen-lockfile` succeeds, proving the lockfile is already valid and that the relaxed flag is unnecessary.
- [x] (2026-03-09 19:24Z) Re-read `PLANS.md`, `apps/brave-search-mcp/package.json`, `apps/brave-search-mcp/test/tsconfig.json`, `apps/brave-search-mcp/test/unit/index.test.ts`, `apps/brave-search-mcp/test/unit/server-utils.test.ts`, `.dockerignore`, and the root `package.json` to tighten this plan against the actual repo layout.
- [x] (2026-03-09 19:30Z) Audited `.github/workflows/docker-build.yml`, `.github/workflows/publish.yml`, `apps/brave-search-mcp/manifest.json`, and `apps/brave-search-mcp/smithery.yaml` to confirm which downstream consumers are affected by the Dockerfile change and which files do not need edits.
- [x] (2026-03-09 19:33Z) Re-read the synthetic `node_modules` checks in `.github/workflows/docker-build.yml` to decide whether this plan should validate only the normal Docker build or also the CI-only Docker context case.
- [x] (2026-03-09 19:35Z) Added `apps/brave-search-mcp/test/unit/dockerfile.test.ts` and confirmed it failed before the Dockerfile change.
- [x] (2026-03-09 19:35Z) Updated `apps/brave-search-mcp/Dockerfile` so the workspace install layer now uses `--frozen-lockfile` while preserving the cache mount.
- [x] (2026-03-09 19:35Z) Re-ran the focused Dockerfile test and confirmed it passed after the Dockerfile change.
- [x] (2026-03-09 19:36Z) Built `apps/brave-search-mcp` locally to regenerate `dist/ui`, which eliminated the missing-bundle failures in `test/unit/server.test.ts`.
- [x] (2026-03-09 19:38Z) Completed the uncached repo-root Docker build and the positive synthetic-`node_modules` Docker CI replay with the new `--frozen-lockfile` install layer.
- [ ] (2026-03-09 19:38Z) Full app unit suite remains red because `test/unit/brave-image-search-tool.test.ts` has three pre-existing expectation mismatches unrelated to the Dockerfile change (completed: focused Dockerfile regression, local build, standard Docker build, synthetic Docker build; remaining: resolve or waive the unrelated `brave-image-search` test failures).

## Surprises & Discoveries

- Observation: `PLANS.md` is present in the repository root even though the first version of this plan claimed otherwise.
  Evidence: Reading `PLANS.md` from `/Users/mike/.codex/worktrees/8db3/brave-search-mcp/PLANS.md` returned the full ExecPlan specification.

- Observation: The current image build succeeds even though the Dockerfile disables lockfile enforcement.
  Evidence: `apps/brave-search-mcp/Dockerfile` line 10 currently reads `RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --no-frozen-lockfile`.

- Observation: The repository already has a valid lockfile, so the Dockerfile does not need the relaxed install mode.
  Evidence: Running `docker run --rm --entrypoint sh brave-search-mcp:test -lc 'cd /app && pnpm install --frozen-lockfile'` returned:

      Scope: all 3 workspace projects
      Lockfile is up to date, resolution step is skipped
      Already up to date

- Observation: Local workspace commands are not safe to assume until dependencies are installed from the repo root.
  Evidence: Running `pnpm -C apps/brave-search-mcp build` before installing workspace dependencies in this worktree failed with `sh: shx: command not found`.

- Observation: `.dockerignore` excludes generated outputs and local state, but it does not exclude `pnpm-lock.yaml`, so the lockfile is already present in the Docker build context.
  Evidence: `.dockerignore` contains `.git`, `.agent`, `node_modules`, `.pnpm-store`, `.turbo`, `**/dist`, and `.env*`, and does not list `pnpm-lock.yaml`.

- Observation: The repo already pins an exact pnpm release at the monorepo root, but the Dockerfile currently installs the broader `pnpm@10` range.
  Evidence: The root `package.json` declares `"packageManager": "pnpm@10.30.1+sha512..."`, while `apps/brave-search-mcp/Dockerfile` line 5 runs `npm install -g pnpm@10`.

- Observation: The repository's release and CI workflows already rely on frozen-lockfile installs everywhere except this Dockerfile.
  Evidence: `.github/workflows/publish.yml` runs `pnpm install --frozen-lockfile` in both publish jobs, while `apps/brave-search-mcp/Dockerfile` still uses `--no-frozen-lockfile`.

- Observation: The dedicated Docker CI workflow consumes this exact Dockerfile, so fixing the file improves both local builds and pull-request validation without requiring workflow edits.
  Evidence: `.github/workflows/docker-build.yml` runs `docker build -t brave-search-mcp:test -f apps/brave-search-mcp/Dockerfile .`.

- Observation: The Docker CI workflow does more than a normal repo-root build. It also validates that `.dockerignore` shields Docker from a synthetic `node_modules/.modules.yaml` file when the repository is copied to a temporary directory.
  Evidence: `.github/workflows/docker-build.yml` creates `node_modules/.modules.yaml` inside a temporary copy and then runs `docker build -t brave-search-mcp:test-synthetic -f "$tmpdir/apps/brave-search-mcp/Dockerfile" "$tmpdir"`.

- Observation: `test/unit/server.test.ts` implicitly depends on generated UI assets under `apps/brave-search-mcp/dist/ui`, even though `test:unit` does not build them first.
  Evidence: Running `pnpm -C apps/brave-search-mcp test:unit` before a local build produced ten `Missing UI bundle at .../dist/ui/...` failures, and those failures disappeared after `pnpm -C apps/brave-search-mcp build`.

- Observation: After regenerating `dist/ui`, the remaining red unit tests are unrelated to the Dockerfile change and are isolated to `test/unit/brave-image-search-tool.test.ts`.
  Evidence: The post-build `pnpm -C apps/brave-search-mcp test:unit` run failed only three tests, all in `test/unit/brave-image-search-tool.test.ts`, expecting `structuredContent` or `CRITICAL RULES` strings that the current code did not return.

## Decision Log

- Decision: Keep this plan scoped to enforcing the lockfile during Docker builds instead of expanding it into a broader "fully hermetic Docker build" project.
  Rationale: The user asked for another Docker-build-related bug, and the strongest concrete defect is that the production image explicitly opts out of the committed lockfile. The pnpm version mismatch is real, but it is adjacent follow-up work rather than necessary to fix this specific bug.
  Date/Author: 2026-03-09 / Codex

- Decision: Add a regression test that reads the Dockerfile text instead of relying only on a manual `docker build`.
  Rationale: The defect is encoded directly in `apps/brave-search-mcp/Dockerfile`. A narrow unit test is deterministic, runs quickly in CI, and fails immediately if someone reintroduces `--no-frozen-lockfile`.
  Date/Author: 2026-03-09 / Codex

- Decision: Make the validation flow test-first by adding the Dockerfile test before editing the Dockerfile.
  Rationale: The new test should demonstrate the current bug, not merely describe it. Running the focused test before the Dockerfile change gives a clear fail-before, pass-after proof.
  Date/Author: 2026-03-09 / Codex

- Decision: Keep `apps/brave-search-mcp/README.md`, `apps/brave-search-mcp/manifest.json`, `apps/brave-search-mcp/smithery.yaml`, and the GitHub workflow files unchanged in this plan.
  Rationale: Those files either document the Docker command or launch the built `dist/index.js`, but none of them duplicate the install flag. The behavior change is fully captured by editing `apps/brave-search-mcp/Dockerfile` and validating the existing consumers against it.
  Date/Author: 2026-03-09 / Codex

- Decision: Validate the positive synthetic-`node_modules` Docker workflow path after the Dockerfile edit, but do not make the negative "remove .dockerignore and expect failure" step part of the required acceptance for this bug.
  Rationale: The positive synthetic build is an existing CI consumer of the Dockerfile and can catch accidental regressions caused by the edit. The negative path is specifically about `.dockerignore` protection, which is a separate already-fixed concern and not necessary to prove the lockfile bug is resolved.
  Date/Author: 2026-03-09 / Codex

- Decision: Do not change `brave-image-search` code or tests as part of this Docker lockfile implementation.
  Rationale: The remaining unit-test failures after rebuilding assets are confined to `test/unit/brave-image-search-tool.test.ts` and concern UI response shape/content expectations that predate the Dockerfile change. Expanding into that area would turn this focused Docker bug fix into an unrelated product-behavior change.
  Date/Author: 2026-03-09 / Codex

## Outcomes & Retrospective

Implementation outcome: the Dockerfile now enforces `--frozen-lockfile`, and a dedicated unit test in `apps/brave-search-mcp/test/unit/dockerfile.test.ts` protects that contract. The focused regression test passes, the uncached Docker build passes, and the positive synthetic Docker CI scenario also passes.

The one remaining validation gap is outside the scope of this change: after rebuilding local assets, `pnpm -C apps/brave-search-mcp test:unit` still reports three failures in `test/unit/brave-image-search-tool.test.ts` that do not mention the Dockerfile or dependency installation. This plan is therefore implemented for the Docker bug itself, with the unrelated `brave-image-search` unit-test drift recorded here for follow-up rather than silently ignored.

## Context and Orientation

This monorepo is rooted at `/Users/mike/.codex/worktrees/8db3/brave-search-mcp`. The workspace layout is declared in `pnpm-workspace.yaml`, which includes `apps/*` and `packages/*`. The production server package lives in `apps/brave-search-mcp`.

The relevant files are:

- `apps/brave-search-mcp/Dockerfile`, which builds the production container image.
- `apps/brave-search-mcp/package.json`, which defines the package-local test commands. The unit test command is `vitest run test/unit`.
- `apps/brave-search-mcp/test/tsconfig.json`, which confirms the tests are compiled as ES modules with Node types available.
- `apps/brave-search-mcp/test/unit/index.test.ts` and `apps/brave-search-mcp/test/unit/server-utils.test.ts`, which show the established Vitest style in this package: direct `describe`/`it` blocks, top-level imports, and no custom test helper framework.
- `apps/brave-search-mcp/README.md`, which documents Docker as a supported user workflow and tells users to run `docker build -t brave-search-mcp:latest -f apps/brave-search-mcp/Dockerfile .` from the repo root.
- `.github/workflows/docker-build.yml`, which already validates this same Dockerfile on pull requests and pushes to `main`, including a synthetic Docker context containing `node_modules/.modules.yaml`.
- `.github/workflows/publish.yml`, which shows the repo's release jobs already expect frozen-lockfile installs.
- `apps/brave-search-mcp/manifest.json` and `apps/brave-search-mcp/smithery.yaml`, which package or launch `dist/index.js` and therefore do not need changes for this Docker install-flag fix.
- `.dockerignore`, which shows that the lockfile is already sent to Docker because it does not exclude `pnpm-lock.yaml`.
- `package.json` at the repo root, which pins the monorepo package manager to `pnpm@10.30.1+sha512...`.

A lockfile is the file that records the exact dependency graph selected by the package manager. In this repo, that file is `pnpm-lock.yaml`. A frozen lockfile install means pnpm must use that exact graph and fail instead of silently changing it. That behavior is appropriate for a production Docker build, because a container image should match the dependency graph committed to source control.

## Milestones

### Milestone 1: Add a failing regression test that captures the Dockerfile contract

Create `apps/brave-search-mcp/test/unit/dockerfile.test.ts` before editing the Dockerfile. The file should use the existing Vitest style and read `apps/brave-search-mcp/Dockerfile` via an ES-module-safe path such as `fileURLToPath(new URL('../../Dockerfile', import.meta.url))`. The test should assert that the install layer matches the frozen-lockfile contract and that `--no-frozen-lockfile` is absent. Run only this new test first. It should fail on the current repository state because the Dockerfile still contains the wrong flag.

At the end of this milestone, the repo has a precise, automated demonstration of the bug. The proof is a failing targeted Vitest run against `test/unit/dockerfile.test.ts`.

### Milestone 2: Tighten the Dockerfile and prove the image still builds

After the regression test is in place, edit `apps/brave-search-mcp/Dockerfile` so the install layer becomes `pnpm install --frozen-lockfile` while preserving the existing `--mount=type=cache,target=/root/.local/share/pnpm/store` cache mount. Re-run the focused test and then the full unit suite via `pnpm -C apps/brave-search-mcp test:unit`. Finally, run an uncached Docker build from the repo root with plain progress output so the install line is visible in the build log, then replay the positive synthetic-`node_modules` Docker CI scenario from `.github/workflows/docker-build.yml`.

At the end of this milestone, the Dockerfile encodes the correct install contract, the targeted regression test passes, the package unit suite passes, the normal Docker build succeeds, and the existing synthetic Docker CI scenario still succeeds. Because `.github/workflows/docker-build.yml` already builds this exact image, this milestone also restores consistency between local Docker builds and the repository's existing CI expectations.

## Plan of Work

Start by making the bug observable in code. Add `apps/brave-search-mcp/test/unit/dockerfile.test.ts` using the existing Vitest conventions already visible in `apps/brave-search-mcp/test/unit/index.test.ts` and `apps/brave-search-mcp/test/unit/server-utils.test.ts`. Because this package is ESM (`"type": "module"` in `apps/brave-search-mcp/package.json`), compute the Dockerfile path from `import.meta.url` instead of relying on CommonJS globals. Read the file once per test file, then assert two things: the Dockerfile contains the exact install line with `--frozen-lockfile`, and it does not contain the string `--no-frozen-lockfile`.

Once that test exists, run it in isolation from the repo root using `pnpm -C apps/brave-search-mcp exec vitest run test/unit/dockerfile.test.ts`. The expected result before the Dockerfile change is failure, because the install line still opts out of the lockfile.

Next, edit `apps/brave-search-mcp/Dockerfile`. Only change the install flag on the workspace install line. Do not change the cache mount, the `COPY . /app` strategy, the working directories, or the entrypoint as part of this plan.

After the Dockerfile edit, rerun the focused test, then run the full package unit suite with `pnpm -C apps/brave-search-mcp test:unit`. The package test command comes directly from `apps/brave-search-mcp/package.json`, so do not invent an alternative wrapper script. Then run an uncached Docker build with `--progress=plain` so the install line is visible even if Docker would otherwise reuse a cached layer. After that, replay the positive synthetic-`node_modules` build from `.github/workflows/docker-build.yml` so the edit is proven against both the standard Docker context and the special CI context. No README, manifest, Smithery, or workflow edits are required unless the Dockerfile change unexpectedly reveals a second bug.

## Concrete Steps

Run all commands from `/Users/mike/.codex/worktrees/8db3/brave-search-mcp` unless a step says otherwise.

1. Ensure workspace dependencies exist locally. If `node_modules` is missing or package commands fail with errors like `sh: shx: command not found`, install from the monorepo root:

      pnpm install

   A successful install may print the non-fatal warning `husky - git command not found, skipping install`. That warning was observed during investigation and does not block this work.

2. Create `apps/brave-search-mcp/test/unit/dockerfile.test.ts`. Use imports from `node:fs`, `node:url`, and `vitest`. The test file should resolve `apps/brave-search-mcp/Dockerfile` from `import.meta.url`, read it as UTF-8 text, and assert both of the following:

      - the file matches a line-level regular expression for
        `RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile`
      - the file does not contain `--no-frozen-lockfile`

3. Run only the new regression test before changing production files:

      pnpm -C apps/brave-search-mcp exec vitest run test/unit/dockerfile.test.ts

   Expect a failing assertion because the Dockerfile still contains `--no-frozen-lockfile`.

4. Edit `apps/brave-search-mcp/Dockerfile` and replace only this line:

      RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --no-frozen-lockfile

   with:

      RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

5. Re-run the focused regression test:

      pnpm -C apps/brave-search-mcp exec vitest run test/unit/dockerfile.test.ts

   Expect the test to pass.

6. Run the full app unit suite:

      pnpm -C apps/brave-search-mcp test:unit

   Expect Vitest to report the existing unit suite plus the new `dockerfile.test.ts` as passing.

7. Run an uncached Docker build with visible logs:

      docker build --no-cache --progress=plain -t brave-search-mcp:latest -f apps/brave-search-mcp/Dockerfile .

   Expect the install layer log to show `pnpm install --frozen-lockfile` and the build to complete successfully. This local command intentionally mirrors the first step in `.github/workflows/docker-build.yml`, except for the added `--no-cache --progress=plain` flags that make the changed layer observable.

8. Replay the positive synthetic Docker CI scenario that verifies `.dockerignore` still protects a temporary context with `node_modules/.modules.yaml`:

      tmpdir="$(mktemp -d)"
      tar -cf - . | tar -xf - -C "$tmpdir"
      mkdir -p "$tmpdir/node_modules"
      printf 'layoutVersion: 5\n' > "$tmpdir/node_modules/.modules.yaml"
      docker build -t brave-search-mcp:test-synthetic -f "$tmpdir/apps/brave-search-mcp/Dockerfile" "$tmpdir"
      rm -rf "$tmpdir"

   Expect the synthetic build to succeed, matching the positive case already encoded in `.github/workflows/docker-build.yml`.

## Validation and Acceptance

The change is complete only when all of the following are true:

1. `pnpm -C apps/brave-search-mcp exec vitest run test/unit/dockerfile.test.ts` fails before the Dockerfile edit and passes after it.
2. `pnpm -C apps/brave-search-mcp test:unit` passes after the Dockerfile edit.
3. `docker build --no-cache --progress=plain -t brave-search-mcp:latest -f apps/brave-search-mcp/Dockerfile .` passes after the Dockerfile edit.
4. The Docker build log visibly shows the install layer using `pnpm install --frozen-lockfile`.
5. `apps/brave-search-mcp/Dockerfile` no longer contains `--no-frozen-lockfile`.
6. The positive synthetic build copied from `.github/workflows/docker-build.yml` still passes after the Dockerfile edit.

## Idempotence and Recovery

The test file and Dockerfile edit are safe to apply repeatedly. Re-running the focused Vitest command, the unit suite, and the Docker build is idempotent.

If the targeted test still passes before the Dockerfile edit, stop and inspect the test because it is not actually proving the bug. If the targeted test passes after the Dockerfile edit but the Docker build fails, treat that as evidence that the manifests and `pnpm-lock.yaml` drifted apart or that the workspace install depends on behavior masked by `--no-frozen-lockfile`.

If the stricter install fails, do not revert to `--no-frozen-lockfile` as the "fix." Instead, repair the real drift by running `pnpm install` intentionally at the repo root, reviewing changes to `pnpm-lock.yaml`, and committing any required lockfile updates alongside the Dockerfile change.

If the Docker build reuses cached layers and hides the install command, rebuild with `--no-cache --progress=plain` exactly as shown above.

If the synthetic Docker-context replay fails while the normal repo-root build passes, compare the local commands against `.github/workflows/docker-build.yml` and inspect whether the Dockerfile change accidentally introduced a new dependency on files that are excluded by `.dockerignore`.

## Artifacts and Notes

Relevant file references:

- `apps/brave-search-mcp/Dockerfile` contains the production image recipe.
- `apps/brave-search-mcp/package.json` defines `test:unit` as `vitest run test/unit`.
- `apps/brave-search-mcp/test/tsconfig.json` enables Node and Vitest globals for test files.
- `apps/brave-search-mcp/test/unit/index.test.ts` and `apps/brave-search-mcp/test/unit/server-utils.test.ts` are the local examples to mirror for test style.
- `apps/brave-search-mcp/README.md` documents Docker as a supported user workflow.
- `.github/workflows/docker-build.yml` already builds this image in CI.
- `.github/workflows/docker-build.yml` also verifies a positive synthetic context with `node_modules/.modules.yaml`, which should continue to pass after this fix.
- `.github/workflows/publish.yml` already uses `pnpm install --frozen-lockfile` in release jobs, showing the Dockerfile is the outlier.
- `apps/brave-search-mcp/manifest.json` and `apps/brave-search-mcp/smithery.yaml` launch built server artifacts and do not encode Docker dependency installation behavior.
- `.dockerignore` does not exclude `pnpm-lock.yaml`, so no Docker context changes are needed for this fix.

Observed command transcripts from investigation:

    $ pnpm -C apps/brave-search-mcp build
    ...
    sh: shx: command not found

    $ docker build --progress=plain -t brave-search-mcp:test -f apps/brave-search-mcp/Dockerfile .
    ...
    #9 [stage-0 5/7] RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --no-frozen-lockfile
    ...

    $ docker run --rm --entrypoint sh brave-search-mcp:test -lc 'cd /app && pnpm install --frozen-lockfile'
    Scope: all 3 workspace projects
    Lockfile is up to date, resolution step is skipped
    Already up to date

    $ pnpm -C apps/brave-search-mcp exec vitest run test/unit/dockerfile.test.ts
    FAIL test/unit/dockerfile.test.ts > Dockerfile > uses frozen lockfile for workspace install
    AssertionError: expected Dockerfile contents to match --frozen-lockfile line

    $ pnpm -C apps/brave-search-mcp exec vitest run test/unit/dockerfile.test.ts
    ✓ test/unit/dockerfile.test.ts (1 test)

    $ docker build --no-cache --progress=plain -t brave-search-mcp:latest -f apps/brave-search-mcp/Dockerfile .
    ...
    #9 [stage-0 5/7] RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
    ...

    $ pnpm -C apps/brave-search-mcp test:unit
    ...
    FAIL test/unit/brave-image-search-tool.test.ts > braveImageSearchTool > returns no-results text and structured content in UI mode
    FAIL test/unit/brave-image-search-tool.test.ts > braveImageSearchTool > skips image results without thumbnail src and reports filtered count in UI mode
    FAIL test/unit/brave-image-search-tool.test.ts > braveImageSearchTool > returns structured error response when execute catches an error in UI mode

Suggested shape for the new test:

    import { readFileSync } from 'node:fs';
    import { fileURLToPath } from 'node:url';
    import { describe, expect, it } from 'vitest';

    const dockerfilePath = fileURLToPath(new URL('../../Dockerfile', import.meta.url));
    const dockerfile = readFileSync(dockerfilePath, 'utf8');

    describe('Dockerfile', () => {
      it('uses frozen lockfile for workspace install', () => {
        expect(dockerfile).toMatch(/^RUN --mount=type=cache,target=\\/root\\/\\.local\\/share\\/pnpm\\/store pnpm install --frozen-lockfile$/m);
        expect(dockerfile).not.toContain('--no-frozen-lockfile');
      });
    });

Follow-up risk that is intentionally out of scope for this plan: the root `package.json` pins `pnpm@10.30.1+sha512...`, but `apps/brave-search-mcp/Dockerfile` still installs `pnpm@10`. That is another reproducibility concern worth a separate plan after this lockfile bug is fixed.

## Interfaces and Dependencies

Use only the tools and interfaces already present in the repository:

- pnpm workspace commands from the repo root.
- Vitest for the regression test. The new file should follow the same direct test style already used in `apps/brave-search-mcp/test/unit/*.test.ts`.
- Node built-in modules `node:fs` and `node:url` inside the new test file.
- Docker for end-to-end validation of the production image recipe.

No new library, helper module, or test harness is needed. The final state should include exactly one new unit test file and one edited Dockerfile line.

Revision note: revised and implemented this ExecPlan after auditing the actual repo files. The update fixes the incorrect claim that `PLANS.md` was absent, adds repo-grounded milestones, makes the regression path explicitly test-first, specifies the ESM-safe way to read `apps/brave-search-mcp/Dockerfile` in Vitest, documents the real prerequisite that local workspace dependencies may be missing, records the adjacent pnpm-version reproducibility risk without expanding the plan's implementation scope, ties the work to the existing Docker and publish GitHub workflows, explicitly marks README and packaging metadata as unchanged for this fix, adds validation for the positive synthetic Docker CI context that already exercises this Dockerfile, and records the unrelated post-build `brave-image-search` test failures that still block a fully green unit suite.
