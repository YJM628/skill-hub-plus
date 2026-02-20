# Skill 开发完整指南

> 本文档整合了 Skill 的概念定义、核心设计原则、目录结构规范、开发最佳实践（正反模式）以及完整的创建流程，旨在为 Skill 开发者提供一站式参考。

---

## 一、什么是 Skill

Skills 是模块化、自包含的扩展包，通过提供专业知识、工作流和工具来扩展 AI Agent 的能力。可以将它们理解为特定领域或任务的"入职指南"——将通用 Agent 转变为具备特定程序性知识的专业 Agent。

### Skill 提供的能力

1. **专业工作流** — 特定领域的多步骤流程
2. **工具集成** — 与特定文件格式或 API 协作的指令
3. **领域专长** — 公司特定知识、数据模式、业务逻辑
4. **捆绑资源** — 用于复杂和重复任务的脚本、参考文档和资产

---

## 二、核心设计原则

### 2.1 简洁至上

上下文窗口是公共资源。Skill 与系统提示、对话历史、其他 Skill 的元数据以及用户请求共享上下文窗口。

**默认假设：AI 已经非常聪明。** 只添加 AI 尚不具备的上下文。对每条信息提出质疑："AI 真的需要这个解释吗？" "这段文字值得它的 token 开销吗？"

**优先使用简洁的示例，而非冗长的解释。**

### 2.2 设定适当的自由度

根据任务的脆弱性和可变性匹配具体程度：

- **高自由度（文本指令）**：多种方法均可行、决策依赖上下文、启发式引导
- **中自由度（伪代码或带参数的脚本）**：存在首选模式、允许一定变化、配置影响行为
- **低自由度（特定脚本、少量参数）**：操作脆弱易出错、一致性至关重要、必须遵循特定顺序

> 类比：窄桥加悬崖需要具体护栏（低自由度），而开阔田野允许多条路线（高自由度）。

### 2.3 单一职责原则

Skill 应专注于解决一类明确问题，功能边界清晰。

**✅ 正确**：`react-component-generator`、`sql-injection-detector`、`api-security-scanner`

**❌ 错误**：`general-coding-helper`（同时做代码生成 + 邮件发送 + 日志分析）、`full-stack-dev-assistant`

### 2.4 内置纠错能力（强制）

输出前主动检查结果正确性，提供明确的验证方法，发现问题后自动修正。

**常见验证策略**：
- 生成测试用例并"模拟运行"
- 对照设计约束逐项核对
- 二次扫描高风险区域

**示例**：
> 在输出最终代码前，请检查：(1) 所有函数是否有类型提示；(2) 是否存在 f-string 拼接 SQL；(3) 是否硬编码了密钥。任一不满足则修正后再输出。

---

## 三、Skill 目录结构

每个 Skill 由一个必需的 `SKILL.md` 文件和可选的捆绑资源组成：

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   └── description: (required)
│   └── Markdown instructions (required)
└── Bundled Resources (optional)
    ├── scripts/          - 可执行代码 (Python/Bash 等)
    ├── references/       - 按需加载到上下文的参考文档
    └── assets/           - 用于输出的文件 (模板、图标、字体等)
```

### 3.1 SKILL.md（必需）

每个 SKILL.md 包含：

- **Frontmatter**（YAML）：包含 `name` 和 `description` 字段。这是 AI 判断何时使用该 Skill 的唯一依据，因此必须清晰、全面地描述 Skill 的功能和使用时机。
- **Body**（Markdown）：使用 Skill 的指令和指南。仅在 Skill 被触发后加载。

#### Frontmatter 编写规范

- **`name`**：Skill 名称
- **`description`**：这是 Skill 的主要触发机制，帮助 AI 理解何时使用该 Skill
  - 同时包含 Skill 的功能描述和具体的触发场景/上下文
  - 所有"何时使用"的信息都放在这里，而非 Body 中（Body 仅在触发后加载，因此 Body 中的"何时使用"部分对 AI 无效）
  - 不要在 frontmatter 中包含其他字段

**示例**（`docx` skill 的 description）：
> "Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. Use when Claude needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"

#### Body 编写规范

- 始终使用祈使句/不定式形式
- 编写使用 Skill 及其捆绑资源的指令

### 3.2 Scripts（`scripts/`）

用于需要确定性可靠性或反复重写的任务的可执行代码。

- **何时包含**：相同代码被反复重写，或需要确定性可靠性
- **示例**：`scripts/rotate_pdf.py` 用于 PDF 旋转任务
- **优势**：节省 token、确定性强、可在不加载到上下文的情况下执行
- **注意**：脚本可能仍需被 AI 读取以进行修补或环境特定调整

### 3.3 References（`references/`）

按需加载到上下文中的文档和参考资料。

- **何时包含**：AI 工作时需要参考的文档
- **示例**：`references/finance.md`（财务模式）、`references/api_docs.md`（API 规范）
- **用途**：数据库模式、API 文档、领域知识、公司政策、详细工作流指南
- **优势**：保持 SKILL.md 精简，仅在 AI 判断需要时加载
- **最佳实践**：如果文件较大（>10k 词），在 SKILL.md 中包含 grep 搜索模式
- **避免重复**：信息应仅存在于 SKILL.md 或 references 文件中，不要两处都有。优先将详细信息放在 references 文件中，SKILL.md 仅保留核心流程指令

### 3.4 Assets（`assets/`）

不用于加载到上下文，而是用于 AI 产出的输出中的文件。

- **何时包含**：Skill 需要在最终输出中使用的文件
- **示例**：`assets/logo.png`（品牌资产）、`assets/slides.pptx`（PPT 模板）、`assets/frontend-template/`（HTML/React 样板）
- **优势**：将输出资源与文档分离，使 AI 无需加载到上下文即可使用文件

### 3.5 不应包含的内容

Skill 应仅包含直接支持其功能的必要文件。**不要**创建以下多余文件：

- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md
- 等

Skill 应仅包含 AI Agent 完成工作所需的信息，不应包含创建过程、设置和测试流程、面向用户的文档等辅助内容。

---

## 四、渐进式披露设计

Skills 使用三级加载系统高效管理上下文：

1. **元数据（name + description）** — 始终在上下文中（约 100 词）
2. **SKILL.md body** — Skill 触发时加载（<5k 词）
3. **捆绑资源** — AI 按需加载（无限制，因为脚本可在不读入上下文的情况下执行）

### 渐进式披露模式

保持 SKILL.md body 精简且不超过 500 行。接近此限制时拆分到单独文件。拆分时务必在 SKILL.md 中引用这些文件并清晰描述何时读取它们。

**核心原则**：当 Skill 支持多种变体、框架或选项时，仅在 SKILL.md 中保留核心工作流和选择指南，将变体特定的细节移至单独的 reference 文件。

#### 模式 1：高层指南 + 引用

```markdown
# PDF Processing

## Quick start
Extract text with pdfplumber:
[code example]

## Advanced features
- **Form filling**: See [FORMS.md](FORMS.md) for complete guide
- **API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
```

AI 仅在需要时加载 FORMS.md 或 REFERENCE.md。

#### 模式 2：按领域/变体组织

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    └── product.md (API usage, features)
```

用户询问销售指标时，AI 仅读取 `sales.md`。

```
cloud-deploy/
├── SKILL.md (workflow + provider selection)
└── references/
    ├── aws.md (AWS deployment patterns)
    ├── gcp.md (GCP deployment patterns)
    └── azure.md (Azure deployment patterns)
```

用户选择 AWS 时，AI 仅读取 `aws.md`。

#### 模式 3：条件性细节

```markdown
# DOCX Processing

## Creating documents
Use docx-js for new documents. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents
For simple edits, modify the XML directly.
**For tracked changes**: See [REDLINING.md](REDLINING.md)
**For OOXML details**: See [OOXML.md](OOXML.md)
```

**重要准则**：
- **避免深层嵌套引用** — 引用保持从 SKILL.md 出发一层深度
- **结构化较长的引用文件** — 超过 100 行的文件在顶部包含目录

---

## 五、输入输出规范

### 5.1 输入格式

**✅ 正确模式**：
- 结构简单，使用易于理解的数据格式
- 语义清晰，数据含义明确
- 推荐格式：纯文本、JSON、代码块
- 说明输入不完整时的处理策略

**示例**：
```json
{
  "code": "def login(username, password):\n    query = f\"SELECT * FROM users WHERE name='{username}'\"",
  "language": "python",
  "rules": ["sql_injection", "hardcoded_credentials"]
}
```

**❌ 错误模式**：格式过于复杂的嵌套结构、语义模糊的输入定义

### 5.2 输出格式

**✅ 正确模式**：
- 机器可读，便于模型解析或下游工具消费
- 提供包含字段名、类型、样例值的完整输出示例
- 使用 Markdown 表格、JSON、代码块等标准格式

**示例**：
```json
{
  "issues": [
    {
      "line": 2,
      "type": "security",
      "severity": "high",
      "description": "SQL injection vulnerability detected",
      "suggestion": "Use parameterized queries"
    }
  ],
  "summary": { "total_issues": 1, "high_severity": 1 }
}
```

**❌ 错误模式**：非结构化的自由格式文本、缺少输出格式示例

---

## 六、工作流程设计

### 6.1 清晰的执行流程

**✅ 正确模式**：
- 3-5 步的具体执行流程
- 每步操作明确、无歧义
- 步骤之间有清晰的依赖关系

**示例**：
1. 解析输入代码并识别编程语言
2. 根据指定规则或默认规则扫描代码
3. 使用模式匹配算法检测潜在漏洞
4. 将检测结果按严重程度排序
5. 生成包含问题描述和修复建议的结构化报告
6. 运行自我验证检查确保报告完整性

**❌ 错误模式**：使用"视情况而定"等不确定表述、缺少具体操作细节

### 6.2 精准触发条件

**✅ 正确模式**：
- 明确的触发时机，详细描述何时调用此 Skill
- 包含关键词匹配，定义用户意图的关键短语
- 上下文特征识别，说明相关的场景特征

**示例**：
> 当用户要求生成一个使用 Tailwind CSS 的响应式导航栏组件时触发

**❌ 错误模式**：触发条件模糊、关键词不明确

---

## 七、系统约束与工具集成

### 7.1 系统约束定义

**✅ 正确模式**：
- 明确支持的语言/框架版本
- 定义最大输入长度
- 说明不支持的使用场景
- 避免过度承诺

**示例**：
- 支持：Python 3.7+，JavaScript ES6+
- 输入限制：最大 5000 行代码
- 不支持：实时数据库连接验证

**❌ 错误模式**：边界不清、声称支持所有场景

### 7.2 MCP 工具集成规范

**✅ 正确模式**：
- 最多调用 3 个 MCP 工具
- 每个工具的输入参数明确
- 返回格式一致且可预测
- 每个工具执行单一功能

**设计理念**：
> 强大 Agent = MCP Tools（能力） + Skill（SOP 流程）

**❌ 错误模式**：集成超过 3 个工具、单个工具承担多种功能

---

## 八、Skill 创建流程

Skill 创建包含以下步骤：

1. 通过具体示例理解 Skill
2. 规划可复用的 Skill 内容（scripts、references、assets）
3. 初始化 Skill（运行 `init_skill.py`）
4. 编辑 Skill（实现资源并编写 SKILL.md）
5. 打包 Skill（运行 `package_skill.py`）
6. 基于实际使用迭代

按顺序执行这些步骤，仅在有明确理由时跳过。

### Step 1：通过具体示例理解 Skill

仅当 Skill 的使用模式已被清晰理解时才跳过此步骤。

要创建有效的 Skill，需清晰理解其具体使用示例。这些理解可来自用户直接提供的示例或经用户反馈验证的生成示例。

**示例问题**（构建 image-editor skill 时）：
- "image-editor skill 应支持哪些功能？编辑、旋转、还有其他吗？"
- "能给一些这个 skill 的使用示例吗？"
- "什么样的用户输入应该触发这个 skill？"

避免在单条消息中提出过多问题。从最重要的问题开始，按需跟进。

### Step 2：规划可复用的 Skill 内容

将具体示例转化为有效 Skill，分析每个示例：

1. 考虑如何从零开始执行该示例
2. 识别在重复执行这些工作流时，哪些 scripts、references 和 assets 会有帮助

**示例分析**：

| Skill | 用户查询 | 分析 | 资源 |
|-------|---------|------|------|
| `pdf-editor` | "帮我旋转这个 PDF" | 每次都需要重写相同代码 | `scripts/rotate_pdf.py` |
| `frontend-webapp-builder` | "帮我构建一个 todo 应用" | 每次都需要相同的样板代码 | `assets/hello-world/` 模板 |
| `big-query` | "今天有多少用户登录？" | 每次都需要重新发现表结构 | `references/schema.md` |

### Step 3：初始化 Skill

如果 Skill 已存在且仅需迭代或打包，跳过此步骤。

从零创建新 Skill 时，始终运行 `init_skill.py` 脚本：

```bash
scripts/init_skill.py <skill-name> --path <output-directory>
```

脚本功能：
- 在指定路径创建 Skill 目录
- 生成带有正确 frontmatter 和 TODO 占位符的 SKILL.md 模板
- 创建示例资源目录：`scripts/`、`references/`、`assets/`
- 在每个目录中添加可自定义或删除的示例文件

### Step 4：编辑 Skill

编辑 Skill 时，记住 Skill 是为另一个 AI 实例使用而创建的。包含对 AI 有益且非显而易见的信息。

#### 学习成熟的设计模式

根据 Skill 需求参考以下指南：
- **多步骤流程**：参见 `references/workflows.md`
- **特定输出格式或质量标准**：参见 `references/output-patterns.md`

#### 从可复用内容开始

从 Step 2 中识别的可复用资源开始实现。此步骤可能需要用户输入（如品牌资产、模板等）。

**关键要求**：
- 添加的脚本必须通过实际运行来测试
- 删除不需要的示例文件和目录

#### 更新 SKILL.md

按照第三节中的 Frontmatter 和 Body 编写规范编写。

### Step 5：打包 Skill

开发完成后，必须打包为可分发的 `.skill` 文件：

```bash
scripts/package_skill.py <path/to/skill-folder>
```

可选指定输出目录：

```bash
scripts/package_skill.py <path/to/skill-folder> ./dist
```

打包脚本将：

1. **自动验证** Skill：
   - YAML frontmatter 格式和必填字段
   - Skill 命名规范和目录结构
   - Description 完整性和质量
   - 文件组织和资源引用

2. **打包**（验证通过后）：创建以 Skill 命名的 `.skill` 文件（本质是 `.zip`），包含所有文件并保持正确的目录结构。

验证失败时，脚本将报告错误并退出。修复错误后重新运行。

### Step 6：迭代

**迭代工作流**：
1. 在真实任务上使用 Skill
2. 注意困难或低效之处
3. 确定 SKILL.md 或捆绑资源应如何更新
4. 实施更改并再次测试

---

## 九、开发检查清单

### 开发前

- [ ] 是否明确了 Skill 的单一核心目标？
- [ ] 能否用一句话清晰描述 Skill 的价值？
- [ ] 触发条件是否具体明确？
- [ ] 输入格式是否简洁明了？
- [ ] 输出格式是否结构化、易于消费？

### 开发中

- [ ] 工作流程是否可执行、无歧义？
- [ ] 是否包含自我验证机制？
- [ ] 系统约束是否明确定义？
- [ ] 是否遵守 MCP 工具集成规范？
- [ ] SKILL.md 是否保持在 500 行以内？
- [ ] 是否遵循渐进式披露原则？

### 发布前

- [ ] 在典型用例上进行了充分测试
- [ ] 错误处理机制正常工作
- [ ] 输出格式符合预期
- [ ] 没有意外的功能依赖
- [ ] 没有多余的文档文件（README、CHANGELOG 等）

---

## 十、常见陷阱

1. **过度工程化**：不要为了功能而功能，解决实际问题优先
2. **忽视错误处理**：始终考虑异常情况和失败路径
3. **缺乏边界意识**：明确定义能力范围，避免过度承诺
4. **上下文膨胀**：SKILL.md 过长、信息重复存放在多处
5. **深层嵌套引用**：引用文件应从 SKILL.md 直接链接，保持一层深度
6. **触发信息放错位置**：所有"何时使用"信息必须放在 frontmatter 的 description 中，而非 Body 中
