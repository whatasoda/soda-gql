# ADR-000: Architecture Decision Record Process

## Status
Accepted

## Context
As the soda-gql project grows, we need a systematic way to:
- Document important technical decisions
- Understand the reasoning behind existing architecture
- Avoid re-discussing settled decisions
- Onboard new contributors effectively
- Track architectural evolution over time

Without proper documentation, we risk:
- Losing context for why certain patterns were chosen
- Making conflicting decisions
- Repeating past mistakes
- Having lengthy discussions about already-settled topics

## Decision
We will adopt Architecture Decision Records (ADRs) using Michael Nygard's lightweight format.

### Structure
- ADRs will be stored in `/docs/decisions/`
- Each ADR is a Markdown file named `XXX-brief-description.md`
- Numbers are assigned sequentially (001, 002, etc.)
- ADR-000 is reserved for this meta-ADR about the process

### Required Sections
1. **Status**: Track the lifecycle (Proposed → Accepted/Rejected → Deprecated)
2. **Context**: Why this decision is needed
3. **Decision**: What we're doing
4. **Consequences**: Trade-offs and impacts (Positive/Negative/Neutral)

### Optional Sections
- Implementation Notes
- Alternatives Considered
- References
- History

### Integration with Development
- Reference ADRs in code: `// See ADR-001 for why we use __relation__`
- Link ADRs in PR descriptions when implementing decisions
- Update CLAUDE.md to reference the ADR process

## Consequences

### Positive
- **Knowledge preservation**: Decisions and rationale are documented
- **Faster onboarding**: New contributors can understand the "why"
- **Better decisions**: Forces thorough thinking about trade-offs
- **Reduced discussions**: Settled decisions have a clear reference
- **Historical record**: Can trace how architecture evolved

### Negative
- **Extra work**: Writing ADRs takes time
- **Maintenance burden**: ADRs may become outdated
- **Process overhead**: Another step in the development workflow

### Neutral
- ADRs are immutable once accepted (use deprecation, not editing)
- Not every decision needs an ADR (use judgment)
- ADRs are living documents until accepted

## Implementation Notes

### Criteria for ADR-worthy decisions
Write an ADR when:
- The decision affects multiple components
- Multiple viable alternatives exist
- The decision would be hard to reverse
- The decision deviates from common practices
- Team members disagree on the approach

### Workflow
1. **Author** creates ADR with "Proposed" status
2. **Team** reviews via PR or discussion
3. **Decision** made and status updated
4. **Implementation** references the ADR
5. **Deprecation** when superseded (never delete)

### Tooling
- Template provided at `adr-template.md`
- README.md maintains index of all ADRs
- Consider future tooling for ADR management (adr-tools)

## Alternatives Considered

### Design Docs
- **Description**: Google-style design documents
- **Pros**: More comprehensive, includes implementation details
- **Cons**: Heavier process, takes longer to write
- **Reason for rejection**: Too heavyweight for our needs

### Wiki Pages
- **Description**: Decisions documented in project wiki
- **Pros**: Easy to edit, rich formatting
- **Cons**: Not versioned with code, can be edited after the fact
- **Reason for rejection**: Want decisions versioned with code

### Code Comments Only
- **Description**: Document decisions only in code
- **Pros**: Decisions near implementation
- **Cons**: Hard to find, no central index, lacks context
- **Reason for rejection**: Insufficient for complex decisions

## References
- [Michael Nygard's original ADR article](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub organization](https://adr.github.io/)
- [ThoughtWorks Tech Radar on ADRs](https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records)

## History
- 2024-01-XX: Initial proposal and acceptance