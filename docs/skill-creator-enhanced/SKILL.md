---
name: skill-creator-enhanced
description: |
  Comprehensive guide for creating, updating, and iterating on effective AI agent skills with built-in quality assurance. Use when users want to: (1) Create a new skill from scratch, (2) Update or improve an existing skill, (3) Review a skill for quality and best practices, (4) Debug why a skill isn't triggering or performing well, (5) Refactor a skill to follow progressive disclosure patterns, (6) Package and distribute a skill. Covers skill architecture, SKILL.md authoring, bundled resources (scripts/references/assets), frontmatter optimization, anti-patterns avoidance, input/output format design, workflow clarity, self-correction mechanisms, MCP tool integration, and development checklists.
---

# Skill Creator Enhanced

Comprehensive guide for creating effective, high-quality AI agent skills.

## What Skills Are

Skills are modular, self-contained packages that extend AI agent capabilities with specialized knowledge, workflows, and tools. They transform a general-purpose agent into a domain specialist equipped with procedural knowledge no model fully possesses.

### What Skills Provide

1. **Specialized workflows** — Multi-step procedures for specific domains
2. **Tool integrations** — Instructions for working with specific file formats or APIs
3. **Domain expertise** — Company-specific knowledge, schemas, business logic
4. **Bundled resources** — Scripts, references, and assets for complex and repetitive tasks

## Core Design Principles

### Concise is Key

The context window is a public good. **Default assumption: the AI is already very smart.** Only add context it doesn't already have. Challenge each piece of information: "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### Set Appropriate Degrees of Freedom

Match specificity to the task's fragility:

- **High freedom (text instructions)**: Multiple valid approaches, context-dependent decisions
- **Medium freedom (pseudocode/parameterized scripts)**: Preferred pattern exists, some variation acceptable
- **Low freedom (specific scripts, few parameters)**: Fragile operations, consistency critical

> Analogy: A narrow bridge with cliffs needs guardrails (low freedom); an open field allows many routes (high freedom).

### Single Responsibility

Each skill solves one class of problems with clear boundaries.

**✅ Good**: `react-component-generator`, `sql-injection-detector`
**❌ Bad**: `general-coding-helper` (code generation + email + log analysis)

### Built-in Self-Correction (Mandatory)

Every skill must verify outputs before delivery. For detailed validation strategies and examples, see [references/anti-patterns.md](references/anti-patterns.md#self-correction).

## Skill Directory Structure

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name + description)
│   └── Markdown body (instructions)
└── Bundled Resources (optional)
    ├── scripts/       — Executable code (Python/Bash/etc.)
    ├── references/    — Documentation loaded into context as needed
    └── assets/        — Files used in output (templates, icons, fonts)
```

### SKILL.md Authoring

#### Frontmatter

Only `name` and `description` fields. The `description` is the **primary triggering mechanism**:

- Include both what the skill does AND specific triggers/contexts
- Put ALL "when to use" information here — NOT in the body (body loads only after triggering)
- Do not include other fields

**Example** (docx skill):
> "Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. Use when Claude needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"

#### Body

- Use imperative/infinitive form throughout
- Write instructions for using the skill and its bundled resources
- Keep under 500 lines; split to references when approaching this limit

### Bundled Resources

#### Scripts (`scripts/`)

Executable code for tasks requiring deterministic reliability or repeatedly rewritten.

- **When**: Same code rewritten repeatedly, or deterministic reliability needed
- **Benefits**: Token efficient, deterministic, executable without loading into context
- **Note**: Scripts may still need reading for patching or environment-specific adjustments

#### References (`references/`)

Documentation loaded as needed into context.

- **When**: AI needs reference material while working
- **Benefits**: Keeps SKILL.md lean, loaded only when needed
- **Best practice**: For files >10k words, include grep search patterns in SKILL.md
- **Avoid duplication**: Information lives in SKILL.md OR references, not both

#### Assets (`assets/`)

Files used in output, not loaded into context.

- **When**: Skill needs files for final output (templates, images, boilerplate)
- **Benefits**: Separates output resources from documentation

#### What NOT to Include

Do NOT create: README.md, INSTALLATION_GUIDE.md, QUICK_REFERENCE.md, CHANGELOG.md, or any auxiliary documentation. Skills contain only what the AI agent needs to do the job.

## Progressive Disclosure

Three-level loading system:

1. **Metadata (name + description)** — Always in context (~100 words)
2. **SKILL.md body** — When skill triggers (<5k words)
3. **Bundled resources** — As needed (unlimited; scripts execute without context loading)

### Disclosure Patterns

**Pattern 1 — High-level guide with references**:
```markdown
## Advanced features
- **Form filling**: See [FORMS.md](FORMS.md)
- **API reference**: See [REFERENCE.md](REFERENCE.md)
```

**Pattern 2 — Domain/variant organization**:
```
skill/
├── SKILL.md (overview + navigation)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```
AI loads only the relevant variant file.

**Pattern 3 — Conditional details**:
```markdown
For simple edits, modify XML directly.
**For tracked changes**: See [REDLINING.md](REDLINING.md)
```

**Guidelines**:
- Keep references one level deep from SKILL.md
- For files >100 lines, include a table of contents at top

## Skill Creation Process

Follow these 6 steps in order, skipping only with clear reason.

### Step 1: Understand with Concrete Examples

Skip only when usage patterns are already clearly understood.

Gather concrete examples of how the skill will be used. Ask focused questions:
- "What functionality should this skill support?"
- "Can you give usage examples?"
- "What user input should trigger this skill?"

Avoid asking too many questions at once. Start with the most important, follow up as needed.

### Step 2: Plan Reusable Contents

Analyze each example to identify reusable resources:

| Skill | User Query | Resource |
|-------|-----------|----------|
| `pdf-editor` | "Rotate this PDF" | `scripts/rotate_pdf.py` |
| `webapp-builder` | "Build a todo app" | `assets/hello-world/` template |
| `big-query` | "How many users logged in?" | `references/schema.md` |

### Step 3: Initialize the Skill

For new skills, run `init_skill.py`:

```bash
scripts/init_skill.py <skill-name> --path <output-directory>
```

Creates: skill directory, SKILL.md template, example `scripts/`, `references/`, `assets/` directories.

Skip if the skill already exists and only needs iteration.

### Step 4: Edit the Skill

Remember: the skill is created for another AI instance. Include information that is beneficial and non-obvious.

#### Implementation Order

1. Start with reusable resources (`scripts/`, `references/`, `assets/`)
2. Test added scripts by actually running them
3. Delete unneeded example files from initialization
4. Write SKILL.md following the authoring guidelines above

#### Quality Gates

Before finalizing, verify against the quality standards:
- **Anti-patterns**: See [references/anti-patterns.md](references/anti-patterns.md) for ✅/❌ patterns on goal definition, triggers, I/O formats, workflows, self-correction, constraints, and MCP integration
- **Checklists**: See [references/checklists.md](references/checklists.md) for pre-development, in-development, and pre-release verification

#### Design Pattern References

- **Multi-step processes**: See references/workflows.md for sequential workflows and conditional logic
- **Output formats/quality standards**: See references/output-patterns.md for template and example patterns

### Step 5: Package the Skill

```bash
scripts/package_skill.py <path/to/skill-folder>
# Optional output directory:
scripts/package_skill.py <path/to/skill-folder> ./dist
```

The script validates (frontmatter, naming, structure, description quality) then packages into a `.skill` file (zip with .skill extension).

Fix any validation errors and re-run if validation fails.

### Step 6: Iterate

1. Use the skill on real tasks
2. Notice struggles or inefficiencies
3. Update SKILL.md or bundled resources
4. Test again
