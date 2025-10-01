# Codex MCP Usage Guide

## Overview

This document provides best practices for effectively using Codex MCP (Model Context Protocol) and solutions for common issues.

## Basic Usage

### 1. Calling Codex MCP

```typescript
// Basic call structure
mcp__codex__codex(
  prompt: string,           // Task description
  sandbox: string,          // Sandbox mode
  approval-policy?: string, // Approval policy
  cwd?: string,            // Working directory
  model?: string           // Model to use
)
```

### 2. Sandbox Modes

Codex MCP supports three sandbox modes:

- **`read-only`**: Read files only. The safest mode
- **`workspace-write`**: Can edit files within the project
- **`danger-full-access`**: Full access permissions (use with caution)

### 3. Approval Policies

Approval policies control when Codex requests user approval before executing commands:

- **`never`**: Execute without approval
- **`on-request`**: Request approval only when needed
- **`on-failure`**: Request approval only on failure
- **`untrusted`**: Request approval for untrusted commands (default)

## Best Practices

### 1. Clear Task Definition

Prompts passed to Codex should be specific and clear:

```markdown
❌ Bad example:
"Improve the code"

✅ Good example:
"Add error handling to the parseQuery function in src/utils/parser.ts,
refactor it to return Result types using neverthrow.
Ensure existing tests pass."
```

### 2. Choosing Appropriate Sandbox Mode

- **Analysis/Investigation tasks**: Use `read-only`
- **Implementation/Fix tasks**: Use `workspace-write`
- **System configuration changes**: Use `danger-full-access` (minimally)

### 3. Providing Context

Recommend including the following information for Codex:

- Project tech stack
- Patterns and conventions to follow
- Relevant file paths
- Concrete examples of expected results

### 4. Incremental Approach

Break complex tasks into small steps:

```markdown
1. First analyze current implementation
2. Identify improvements
3. Write tests (TDD)
4. Modify implementation
5. Run tests to verify
```

## Common Issues and Solutions

### Issue 1: Codex doesn't make expected changes

**Cause**: Ambiguous or incomplete prompt

**Solution**:
- Provide more specific instructions
- Include examples or templates
- Use `mcp__codex__codex-reply` to send additional instructions

### Issue 2: File not found errors

**Cause**: Incorrect working directory

**Solution**:
- Explicitly set the `cwd` parameter
- Use absolute paths instead of relative paths
- Use paths relative to project root

### Issue 3: Permission errors

**Cause**: Sandbox mode too restrictive

**Solution**:
- Select appropriate sandbox mode for the task
- Adjust `approval-policy` as needed
- Verify file system permissions

### Issue 4: Timeout errors

**Cause**: Task too complex or time-consuming

**Solution**:
- Split task into smaller parts
- Remove unnecessary processing
- Consider more efficient approach

### Issue 5: Context loss

**Cause**: Context lost in long conversations

**Solution**:
- Use `conversationId` to continue conversations
- Periodically reconfirm important information
- Use memory features to save important information

## Advanced Usage

### 1. Continuing Conversations

```typescript
// Initial call
const response = mcp__codex__codex({
  prompt: "Initial task",
  sandbox: "workspace-write"
})

// Continue conversation
mcp__codex__codex-reply({
  conversationId: response.conversationId,
  prompt: "Additional instructions"
})
```

### 2. Custom Configuration

Use the `config` parameter to pass detailed settings:

```typescript
mcp__codex__codex({
  prompt: "Task",
  config: {
    max_tokens: 4000,
    temperature: 0.7,
    // Other settings
  }
})
```

### 3. Error Handling

Always validate Codex responses and handle errors appropriately:

```typescript
try {
  const result = await mcp__codex__codex(params)
  if (result.error) {
    // Error handling
  }
} catch (error) {
  // Handle connection errors etc.
}
```

## Performance Optimization

### 1. Parallel Processing

Execute independent tasks in parallel:

```typescript
// Execute multiple tasks simultaneously
Promise.all([
  mcp__codex__codex({ prompt: "Task 1", sandbox: "read-only" }),
  mcp__codex__codex({ prompt: "Task 2", sandbox: "read-only" })
])
```

### 2. Cache Utilization

Don't repeat the same analysis:
- Save analysis results to memory
- Reuse as needed

### 3. Minimal Context

Don't include entire large files or directories:
- Specify only relevant parts
- Exclude unnecessary information

## Security Considerations

### 1. Sandbox Mode Principles

- Use most restrictive mode by default
- Gradually relax permissions as needed
- `danger-full-access` is last resort

### 2. Handling Sensitive Information

- Be careful with environment variables and config files
- Don't include API keys or tokens directly
- Verify output doesn't contain sensitive information

### 3. Code Execution Monitoring

- Review commands before execution
- Regularly review logs
- Stop immediately if suspicious behavior detected

## Troubleshooting Checklist

When issues occur, check:

- [ ] Is the prompt clear and specific?
- [ ] Is the appropriate sandbox mode selected?
- [ ] Are necessary permissions granted?
- [ ] Is the working directory correct?
- [ ] Are file paths accurate?
- [ ] Is the task split into appropriate sizes?
- [ ] Are error messages interpreted correctly?
- [ ] Are you referring to the latest documentation?

## Reference Links

- [Claude Code MCP Documentation](https://docs.claude.com/en/docs/claude-code/mcp)
- [OpenAI Codex CLI Documentation](https://developers.openai.com/codex/cli/)
- [Model Context Protocol Specification](https://github.com/anthropics/model-context-protocol)

## Revision History

- 2025-09-28: Initial version - Basic usage and troubleshooting guide for Codex MCP