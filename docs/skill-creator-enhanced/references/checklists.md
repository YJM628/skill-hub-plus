# Skill Development Checklists

Structured verification checklists for each phase of skill development. Read this file when preparing to develop, during development, or before releasing a skill.

## Table of Contents

1. [Pre-Development Checklist](#pre-development-checklist)
2. [In-Development Checklist](#in-development-checklist)
3. [Pre-Release Checklist](#pre-release-checklist)
4. [Common Pitfalls](#common-pitfalls)

---

## Pre-Development Checklist

Verify these before writing any code or content:

- [ ] **Single core goal defined**: The skill solves one class of problems
- [ ] **One-sentence value statement**: Can clearly describe the skill's value in one sentence
- [ ] **Specific trigger conditions**: Detailed description of when to invoke this skill
- [ ] **Input format designed**: Simple, clear, with semantic meaning
- [ ] **Output format designed**: Structured, machine-readable, with complete examples
- [ ] **Concrete usage examples gathered**: At least 3 representative use cases identified
- [ ] **Reusable resources planned**: Scripts, references, and assets identified from examples

---

## In-Development Checklist

Verify these during implementation:

### SKILL.md Quality

- [ ] **Frontmatter complete**: `name` and `description` fields present, no extra fields
- [ ] **Description comprehensive**: Includes what the skill does AND when to use it
- [ ] **No "when to use" in body**: All trigger information is in frontmatter description
- [ ] **Imperative form**: Body uses imperative/infinitive form throughout
- [ ] **Under 500 lines**: SKILL.md body stays lean; excess content split to references
- [ ] **Progressive disclosure applied**: Detailed content moved to reference files with clear links

### Workflow Quality

- [ ] **3-5 step workflow**: Concrete, executable, unambiguous steps
- [ ] **Clear dependencies**: Logical flow between steps
- [ ] **No vague language**: No "depends on situation" or similar uncertain expressions

### Self-Correction

- [ ] **Verification mechanism included**: Output checked before delivery
- [ ] **Specific validation strategies**: Clear methods for checking correctness
- [ ] **Auto-correction logic**: Discovered issues trigger automatic fixes

### System Constraints

- [ ] **Capability boundaries defined**: Supported languages/frameworks/versions stated
- [ ] **Input limits specified**: Maximum input size defined
- [ ] **Unsupported scenarios listed**: Clear about what the skill cannot do
- [ ] **No over-promising**: Realistic about capabilities

### MCP Integration (if applicable)

- [ ] **Maximum 3 tools**: No more than 3 MCP tools integrated
- [ ] **Clear tool parameters**: Each tool's inputs well-defined
- [ ] **Predictable outputs**: Consistent return formats
- [ ] **Single responsibility per tool**: Each tool does one thing

### Resource Organization

- [ ] **No duplicate information**: Content exists in ONE place only
- [ ] **References one level deep**: No nested reference chains
- [ ] **Long files have TOC**: Files >100 lines include table of contents
- [ ] **No unnecessary files**: No README, CHANGELOG, INSTALLATION_GUIDE, etc.
- [ ] **Scripts tested**: Added scripts verified by actual execution
- [ ] **Example files cleaned**: Unused initialization examples deleted

---

## Pre-Release Checklist

Verify these before packaging and distributing:

- [ ] **Typical use cases tested**: Skill tested on representative real-world scenarios
- [ ] **Error handling works**: Graceful handling of edge cases (empty input, malformed data, oversized input)
- [ ] **Output format correct**: Actual output matches documented format
- [ ] **No unexpected dependencies**: Skill is self-contained
- [ ] **No auxiliary documentation**: Only essential files included
- [ ] **Packaging validates**: `scripts/package_skill.py` passes without errors
- [ ] **Description triggers correctly**: Skill activates for intended user queries
- [ ] **Description doesn't over-trigger**: Skill doesn't activate for unrelated queries

---

## Common Pitfalls

Avoid these frequently observed mistakes:

### 1. Over-Engineering
**Problem**: Adding features for the sake of features instead of solving actual problems.
**Fix**: Start with minimum viable skill, add features only when real usage demands them.

### 2. Ignoring Error Handling
**Problem**: Not considering exception cases and failure paths.
**Fix**: For each workflow step, ask "What if this fails?" and document the recovery strategy.

### 3. Lack of Boundary Awareness
**Problem**: Not defining capability scope, leading to over-promising.
**Fix**: Explicitly state what the skill supports AND what it does not support.

### 4. Context Bloat
**Problem**: SKILL.md too long, information duplicated across multiple files.
**Fix**: Apply progressive disclosure — keep SKILL.md under 500 lines, split details to references.

### 5. Deeply Nested References
**Problem**: Reference files linking to other reference files, creating navigation confusion.
**Fix**: All reference files link directly from SKILL.md, one level deep only.

### 6. Trigger Info in Wrong Place
**Problem**: "When to use" information placed in SKILL.md body instead of frontmatter description.
**Fix**: Move ALL trigger/usage context information to the `description` field in frontmatter.

### 7. Missing Self-Correction
**Problem**: Skill outputs results without any verification step.
**Fix**: Add explicit verification checklist before final output delivery.

### 8. Inconsistent Output Format
**Problem**: Output format varies between runs (sometimes list, sometimes paragraph, sometimes table).
**Fix**: Define a single, structured output format with complete examples and enforce it in the workflow.
