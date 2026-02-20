# Skill Development Anti-Patterns Guide

Comprehensive ✅/❌ pattern reference for building high-quality skills. Read this file when reviewing or improving a skill's quality.

## Table of Contents

1. [Goal Definition](#1-goal-definition)
2. [Trigger Conditions](#2-trigger-conditions)
3. [Input Format](#3-input-format)
4. [Output Format](#4-output-format)
5. [Workflow Clarity](#5-workflow-clarity)
6. [Self-Correction](#6-self-correction)
7. [System Constraints](#7-system-constraints)
8. [MCP Tool Integration](#8-mcp-tool-integration)
9. [Context Management](#9-context-management)

---

## 1. Goal Definition

### ✅ Correct Patterns

- **Single responsibility**: Skill focuses on solving one class of problems
  - Examples: `react-component-generator`, `sql-injection-detector`, `api-security-scanner`
- **Clear value statement**: Core value expressible in one sentence
- **Defined boundaries**: Only handles specific domain problems

### ❌ Anti-Patterns

- **Feature sprawl**: Contains multiple unrelated features
  - Example: `general-coding-helper` (code generation + email + log analysis)
- **Vague goals**: Cannot clearly describe what problem it solves
- **Kitchen-sink design**: Tries to solve all related problems
  - Example: `full-stack-dev-assistant`

**✅ Good Example**:
```
Name: api-security-scanner
Goal: Detect security vulnerabilities in REST API code (injection, auth bypass, data exposure)
One-liner: Automatically scan API code and report potential security risks
```

**❌ Bad Example**:
```
Name: full-stack-dev-assistant
Goal: Help developers write frontend, backend, database, testing, deployment, monitoring code
One-liner: All-purpose development assistant (too broad, no focus)
```

---

## 2. Trigger Conditions

### ✅ Correct Patterns

- **Specific timing**: Detailed description of when to invoke the skill
- **Keyword matching**: Define key phrases for user intent recognition
- **Context feature recognition**: Describe relevant scenario characteristics

**Example**:
> Trigger when user requests generating a responsive navbar component using Tailwind CSS

### ❌ Anti-Patterns

- **Vague triggers**: Lack specific timing description
- **Unclear keywords**: No defined user intent recognition patterns
- **Trigger info in wrong place**: "When to use" info placed in body instead of frontmatter description

**Critical rule**: ALL "when to use" information belongs in the frontmatter `description` field, NOT in the body. The body only loads after triggering, so "When to Use This Skill" sections in the body are invisible to the AI during trigger evaluation.

---

## 3. Input Format

### ✅ Correct Patterns

- **Simple structure**: Easy-to-understand data formats
- **Clear semantics**: Unambiguous data meaning
- **Recommended formats**: Plain text, JSON, code blocks
- **Incomplete input handling**: Strategy for when input is missing

**Example**:
```json
{
  "code": "def login(username, password):\n    query = f\"SELECT * FROM users WHERE name='{username}'\"",
  "language": "python",
  "rules": ["sql_injection", "hardcoded_credentials"]
}
```

### ❌ Anti-Patterns

- **Complex nesting**: Overly complex nested structures
- **Ambiguous semantics**: Unclear input data meaning
- **No format specification**: "User provides code in any format"

---

## 4. Output Format

### ✅ Correct Patterns

- **Machine-readable**: Easy for models to parse or downstream tools to consume
- **Complete examples**: Include field names, types, and sample values
- **Standard formats**: Markdown tables, JSON, code blocks

**Example**:
```json
{
  "issues": [
    {
      "line": 2,
      "type": "security",
      "severity": "high",
      "description": "SQL injection vulnerability detected",
      "suggestion": "Use parameterized queries instead of string concatenation"
    }
  ],
  "summary": {
    "total_issues": 1,
    "high_severity": 1,
    "medium_severity": 0,
    "low_severity": 0
  }
}
```

### ❌ Anti-Patterns

- **Unstructured output**: Free-form text difficult to parse
- **Missing examples**: No output format examples provided
- **Inconsistent format**: Sometimes list, sometimes paragraph, sometimes table

---

## 5. Workflow Clarity

### ✅ Correct Patterns

- **Step-by-step execution**: 3-5 concrete steps
- **Actionable**: Each step is clear and unambiguous
- **Logical coherence**: Clear dependencies between steps

**Example**:
1. Parse input code and identify programming language
2. Scan code against specified or default rules
3. Detect potential vulnerabilities using pattern matching
4. Sort results by severity
5. Generate structured report with descriptions and fix suggestions
6. Run self-validation to ensure report completeness

### ❌ Anti-Patterns

- **Vague processing**: Using "depends on the situation" or similar uncertain language
- **Missing details**: Lacking specific operational steps
- **Example of bad workflow**:
  1. Analyze code
  2. Find problems (process unclear)
  3. Generate report (no specific steps)

---

## 6. Self-Correction

### ✅ Correct Patterns (Mandatory)

- **Verification mechanism**: Proactively check result correctness before output
- **Specific strategies**: Provide clear validation methods
- **Auto-correction**: Fix issues when discovered

**Common validation strategies**:
- Generate test cases and "simulate execution"
- Cross-check against design constraints item by item
- Second scan of high-risk areas

**Example**:
> Before outputting final code, check: (1) All functions have type hints; (2) No f-string SQL concatenation; (3) No hardcoded secrets. If any check fails, correct and re-output.

### ❌ Anti-Patterns

- **No verification**: Missing self-check mechanism
- **Assumed correctness**: Directly outputting unverified results
- **Catch-all error handling**: Catching errors without meaningful processing

---

## 7. System Constraints

### ✅ Correct Patterns

- **Capability boundaries**: Clearly state supported languages/framework versions
- **Input limits**: Define maximum input length
- **Scenario limits**: State unsupported use cases
- **Reasonable expectations**: Avoid over-promising

**Example**:
- Supported: Python 3.7+, JavaScript ES6+
- Input limit: Maximum 5000 lines of code
- Not supported: Real-time database connection validation

### ❌ Anti-Patterns

- **Unclear boundaries**: No defined capability limits
- **Over-promising**: Claiming to support all scenarios
- **No version specification**: Not stating which versions are supported

---

## 8. MCP Tool Integration

### ✅ Correct Patterns

- **Limited tools**: Maximum 3 MCP tools per skill
- **Clear inputs**: Each tool's input parameters are well-defined
- **Predictable outputs**: Consistent, predictable return formats
- **Single responsibility**: Each tool performs one function

**Design philosophy**:
> Powerful Agent = MCP Tools (capabilities) + Skill (SOP workflow)

**Tool call specification example**:
```json
{
  "tool": "git-fetch-file",
  "params": {"repo": "user/app", "file_path": "src/main.py", "ref": "main"}
}
```

### ❌ Anti-Patterns

- **Too many tools**: Integrating more than 3 tools
- **Mixed responsibilities**: Single tool handling multiple functions
- **Unclear parameters**: Ambiguous tool input/output specifications

---

## 9. Context Management

### ✅ Correct Patterns

- **SKILL.md under 500 lines**: Split to references when approaching limit
- **No duplication**: Information lives in ONE place (SKILL.md or references, not both)
- **Flat references**: Keep references one level deep from SKILL.md
- **Structured long files**: Files >100 lines include table of contents

### ❌ Anti-Patterns

- **Context bloat**: SKILL.md too long, information duplicated across files
- **Deeply nested references**: Reference files linking to other reference files
- **No navigation**: Large reference files without table of contents
- **Unnecessary files**: Including README, CHANGELOG, INSTALLATION_GUIDE, etc.
