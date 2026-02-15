# Phase 4 Implementation Plan: Session-based Agent Execution

## Task Summary

To execute Phase 4 (Tests, Fixtures, Documentation) using a session-based approach, update the agent harness and split Phase 4 tasks into 5 sessions documented in `agent-progress.md`.

**Branch**: `docs/plan-tagged-template-unification` (continuing on current branch)

## Investigation Summary

### Current Agent Harness

- `agent/run-agent.sh`: Runs `claude --print` in an infinite loop
- `agent/AGENT_PROMPT.md`: In-session workflow and coding conventions
- `agent/agent-progress.md`: Progress tracking by Phase/Round/Task units

### Problems

1. No session length control — runs until context exhaustion
2. Phase 4 task granularity too coarse — summary-level descriptions only
3. Scope boundaries between sessions undefined

### Phase 4 Remaining Work

| Category | Files | Instances | Complexity |
|----------|-------|-----------|------------|
| Fixture-catalog operations | ~42 | ~66 | LOW |
| Fixture-catalog fragments | 2 | 2 | LOW |
| Core type tests | 6 | ~30+ | MEDIUM |
| Core integration tests | 6 | ~20+ | MEDIUM |
| Core composer unit tests | 4 | ~40+ | HIGH |
| Playgrounds | ~10 | ~50 | MEDIUM |
| Documentation | 3 | ~10 | LOW |
| Prebuilt-generator | 1 | TBD | MEDIUM |

---

## Steps

### Step 1: Update `agent-progress.md` with Phase 4 session-scoped tasks

**Commit**: `docs(agent): add Phase 4 session-scoped task definitions`

**Dependencies**: None (first step)
**Produces**: Detailed task list referenced by all subsequent steps

**File changes**:

- `agent/agent-progress.md` — Replace the current Phase 4 placeholder with 5 session definitions:

```markdown
## Phase 4: Tests, Fixtures, Documentation

STATUS: not_started

### Session 4.1: Fixture-catalog operation conversion (~44 files)
MAX_COMMITS: 4
SCOPE: Convert all remaining callback-syntax operations and fragments in fixture-catalog/

- [ ] Task 4.1.1: Convert fixture-catalog/fixtures/core/valid/ operations (simple: sample, top-level-simple, arrow-function, etc.)
- [ ] Task 4.1.2: Convert fixture-catalog/fixtures/core/valid/ operations (complex: deep-nesting, inputs, operations/, runtime/)
- [ ] Task 4.1.3: Convert fixture-catalog/fixtures/core/valid/ remaining fragments (imported-binding-refs, nested-namespace-deps)
- [ ] Task 4.1.4: Convert fixture-catalog/fixtures/formatting/ and fixture-catalog/fixtures/incremental/ operations
- [ ] Task 4.1.5: Session gate — bun run test

### Session 4.2: Core type & integration tests (12 files)
MAX_COMMITS: 5
SCOPE: Convert packages/core/test/ callback builder usage to tagged templates

- [ ] Task 4.2.1: Convert type tests LOW (alias-handling, union-field-selection)
- [ ] Task 4.2.2: Convert type tests MEDIUM (directive-application, variable-builder, operation-definition)
- [ ] Task 4.2.3: Convert type tests MEDIUM (fragment-spreading, nested-object-selection)
- [ ] Task 4.2.4: Convert integration tests (metadata-with-variables, nested-var-ref, document-transform, metadata-adapter)
- [ ] Task 4.2.5: Session gate — bun run test

### Session 4.3: Core composer unit tests (4 files, high complexity)
MAX_COMMITS: 4
SCOPE: Convert packages/core/src/composer/*.test.ts callback builder usage

- [ ] Task 4.3.1: Convert shorthand-fields.test.ts (~437 lines)
- [ ] Task 4.3.2: Convert gql-composer.test.ts + gql-composer.helpers-injection.test.ts
- [ ] Task 4.3.3: Convert operation.document-transform.test.ts
- [ ] Task 4.3.4: Session gate — bun run test

### Session 4.4: Playgrounds + prebuilt-generator (~10 files)
MAX_COMMITS: 4
SCOPE: Convert all playground callback syntax + assess prebuilt-generator

- [ ] Task 4.4.1: Convert playgrounds/hasura/src/graphql/ (fragments.ts: 17 defs, operations.ts: 14 defs)
- [ ] Task 4.4.2: Convert playgrounds/vite-react/ (fragments, operations, component fragments)
- [ ] Task 4.4.3: Convert playgrounds/nextjs-webpack/, expo-metro/, nestjs-compiler-tsc/
- [ ] Task 4.4.4: Assess and update prebuilt-generator context types if needed
- [ ] Task 4.4.5: Session gate — bun run test

### Session 4.5: Documentation + final phase gate
MAX_COMMITS: 4
SCOPE: Update documentation examples + final verification

- [ ] Task 4.5.1: Update README.md callback builder examples to tagged template
- [ ] Task 4.5.2: Update packages/core/README.md examples
- [ ] Task 4.5.3: Update docs/guides/define-element.md and any other guide docs
- [ ] Task 4.5.4: Final phase gate — bun run test && bun quality
- [ ] Task 4.5.5: Update agent-progress.md — mark Phase 4 complete
```

**Validation**: `agent-progress.md` parses correctly and all tasks reference real file paths

---

### Step 2: Rewrite `agent/AGENT_PROMPT.md` with session-scoped workflow

**Commit**: `refactor(agent): add session-scoped workflow with MAX_COMMITS control`

**Dependencies**: Step 1 (references session structure in progress file)
**Produces**: Updated prompt that instructs agent to follow session scope and commit limits

**File changes**:

- `agent/AGENT_PROMPT.md` — Key changes:

1. **Session Selection**: Replace "find first `not_started` task" with "find first `not_started` session, work only on that session's tasks"

2. **MAX_COMMITS Control**: Add exit rule:
```markdown
## Session Length Control

Each session has a MAX_COMMITS limit defined in agent-progress.md.
Track your commit count during the session. When you reach MAX_COMMITS:
1. Update agent-progress.md with completed tasks
2. Commit the progress update
3. Output "SESSION_COMPLETE" and stop working

If you finish all session tasks before reaching MAX_COMMITS, that is fine — commit progress and exit.
```

3. **Graceful Exit**: Add explicit exit protocol:
```markdown
## Exit Protocol

When your session is complete (all tasks done OR MAX_COMMITS reached):
1. Run `bun run test` to verify no regressions
2. Update agent-progress.md: mark completed tasks, update session status
3. Commit: `docs(agent): update progress - Session X.Y [partial|complete]`
4. Output the final line: "SESSION_COMPLETE: Session X.Y [status]"
```

4. **Remove Phase 1-3 specific content**: Strip Round 1-4 quick references, Phase 1 file listings — no longer needed

5. **Add Phase 4 conversion patterns reference**: Include the tagged template syntax patterns the agent needs for conversion:
```markdown
## Phase 4 Conversion Patterns

### Fragment: Callback → Tagged Template
// Before:
fragment.User({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) })
// After:
fragment.User`id name`

### Operation: Callback → Tagged Template
// Before:
query.operation({
  name: "GetUser",
  fields: ({ f }) => ({ ...f.user()(({ f }) => ({ ...f.id() })) })
})
// After (operation tagged template is defined in gql-composer context):
query`query GetUser { user { id } }`

### Fragment with variables:
// Before:
fragment.User({ fields: ({ f, $ }) => ({ ...f.posts({ first: $.count })(({ f }) => ({ ...f.title() })) }) })
// After:
fragment.User`posts(first: $count) { title }`
```

**Validation**: Read the updated file, verify it's self-consistent and doesn't reference Phase 1-3 specifics

---

### Step 3: Update `agent/run-agent.sh` with session tracking

**Commit**: `refactor(agent): add session tracking to run-agent.sh`

**Dependencies**: Step 2 (prompt must be ready before running)
**Produces**: Updated shell script with session-aware logging

**File changes**:

- `agent/run-agent.sh` — Changes:

1. **Session-aware prompt**: Change the `-p` prompt to reference session scope:
```bash
-p "Read agent/agent-progress.md. Find the first session with status not_started or in_progress. Work ONLY on that session's tasks. Respect the MAX_COMMITS limit. When done, output SESSION_COMPLETE."
```

2. **Session logging**: Capture session output and check for SESSION_COMPLETE marker:
```bash
# After session completes
if grep -q "SESSION_COMPLETE" "$LOGFILE"; then
    echo "--- Session completed normally ---"
else
    echo "--- Session may have ended abnormally (no SESSION_COMPLETE marker) ---"
fi
```

3. **All-sessions-done detection**: Add check for overall completion:
```bash
# Check if all sessions are complete
if grep -q "PHASE_4_STATUS: complete" "$PROJECT_DIR/agent/agent-progress.md"; then
    echo "=== All Phase 4 sessions complete ==="
    exit 0
fi
```

**Validation**: `bash -n agent/run-agent.sh` (syntax check), review script logic manually

---

## Risks and Mitigation

### Risk 1: Agent ignores MAX_COMMITS and continues past limit
**Likelihood**: Medium — prompt-based control depends on agent compliance
**Mitigation**: The prompt instructs a clear "output SESSION_COMPLETE and stop" protocol. The shell script detects missing SESSION_COMPLETE markers and logs warnings. If this proves unreliable, add shell-level commit counting as a backup in a follow-up.

### Risk 2: Conversion patterns are insufficient for complex cases
**Likelihood**: Low-Medium — some tests have complex variable/metadata patterns
**Mitigation**: The AGENT_PROMPT includes conversion patterns. For HIGH complexity tasks (Session 4.3), the MAX_COMMITS limit is conservative (4) to allow time for iteration. The agent has access to existing tagged template tests as reference.

### Risk 3: Test regressions from fixture changes cascade across packages
**Likelihood**: Medium — fixture-catalog is used by builder/typegen/sdk tests
**Mitigation**: Each session ends with `bun run test` gate. Session 4.1 (fixtures) runs first, catching cascading issues before other sessions proceed.

---

## Subagent Utilization Plan

| Step | Mode | Rationale |
|------|------|-----------|
| Step 1 | Main-context | Modifies shared progress file; needs iterative refinement based on exact file counts |
| Step 2 | Main-context | Modifies shared prompt file; design decisions already made but content needs careful integration |
| Step 3 | Main-context | Small file, depends on Step 2 output format (SESSION_COMPLETE marker) |

All 3 steps are sequential and modify related files — main context is appropriate for all.
