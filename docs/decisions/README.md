# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records (ADRs) - documents that capture important architectural decisions made along with their context and consequences.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences. ADRs help:
- Future developers understand why decisions were made
- Avoid repeating past discussions
- Track the evolution of the architecture
- Onboard new team members

## When to Write an ADR

Write an ADR when:
- Making significant architectural choices
- Choosing between multiple viable options
- Deviating from established patterns
- Adopting new technologies or patterns
- Making decisions that will be hard to reverse

## ADR Format

We use a lightweight format based on Michael Nygard's template:

```markdown
# ADR-XXX: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context
[Describe the issue motivating this decision]

## Decision
[Describe the decision and how it addresses the context]

## Consequences
### Positive
[What benefits this decision brings]

### Negative
[What drawbacks or trade-offs this decision has]

### Neutral
[What facts that neither improve nor worsen the situation]

## Implementation Notes
[Optional: Specific implementation details]

## Alternatives Considered
[Optional: Other options that were evaluated]

## References
[Optional: Links to related documents, discussions, or code]
```

## Current ADRs

| ID | Title | Status | Date |
|----|-------|--------|------|
| [001](001-relation-field-selection.md) | Explicit Relation Marking with __relation__ | Accepted | 2024-01 |
| [002](002-type-brand-safety.md) | Runtime-Safe Type Brand Properties | Accepted | 2024-01 |

## Process

1. **Propose**: Create a new ADR with status "Proposed"
2. **Discuss**: Share with team for feedback
3. **Decide**: Update status to "Accepted" or "Rejected"
4. **Implement**: Reference the ADR in code comments and PRs
5. **Review**: Periodically review ADRs for relevance

## Guidelines

- **Be concise**: ADRs should be brief but complete
- **Use examples**: Include code examples where helpful
- **Link to code**: Reference implementation files
- **Keep history**: Don't delete old ADRs, mark them as deprecated
- **Number sequentially**: Use format ADR-XXX (e.g., ADR-001)

## Template

Use [adr-template.md](adr-template.md) as a starting point for new ADRs.

## References

- [Michael Nygard's ADR template](https://github.com/joelparkerhenderson/architecture-decision-record)
- [Lightweight Architecture Decision Records](https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records)