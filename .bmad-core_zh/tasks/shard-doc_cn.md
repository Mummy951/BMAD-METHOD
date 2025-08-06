# 文档分片任务

## 目的

- 根据二级标题将大型文档拆分为多个较小的文档
- 创建文件夹结构以组织分片文档
- 保持所有内容完整性，包括代码块、图表和 Markdown 格式

## 主要方法：使用 markdown-tree 自动分片

[[LLM: 首先，检查 .bmad-core/core-config.yaml 中 markdownExploder 是否设置为 true。如果为 true，尝试运行命令：`md-tree explode {input file} {output path}`。

如果命令成功，请通知用户文档已成功分片并“停止” - 不要继续。

如果命令失败（特别是出现命令未找到或不可用的错误），请通知用户：“markdownExploder 设置已启用，但 md-tree 命令不可用。请执行以下操作之一：

1. 使用以下命令全局安装 @kayvan/markdown-tree-parser：`npm install -g @kayvan/markdown-tree-parser`
2. 或者在 .bmad-core/core-config.yaml 中将 markdownExploder 设置为 false

**重要：在此停止 - 在采取上述任何操作之前，请勿继续手动分片。**”

如果 markdownExploder 设置为 false，请通知用户：“markdownExploder 设置当前为 false。为了获得更好的性能和可靠性，您应该：

1. 在 .bmad-core/core-config.yaml 中将 markdownExploder 设置为 true
2. 使用以下命令全局安装 @kayvan/markdown-tree-parser：`npm install -g @kayvan/markdown-tree-parser`

我现在将继续手动分片过程。”

然后仅当 markdownExploder 为 false 时才继续下面的手动方法。]]

### 安装和使用

1. **全局安装**：

   ```bash
   npm install -g @kayvan/markdown-tree-parser
   ```

2. **使用 explode 命令**：

   ```bash
   # 对于 PRD
   md-tree explode docs/prd.md docs/prd

   # 对于架构
   md-tree explode docs/architecture.md docs/architecture

   # 对于任何文档
   md-tree explode [源文档] [目标文件夹]
   ```

3. **其作用**：
   - 根据二级标题自动拆分文档
   - 创建正确命名的文件
   - 适当调整标题级别
   - 处理代码块和特殊 markdown 的所有边缘情况

如果用户已安装 @kayvan/markdown-tree-parser，请使用它并跳过下面的手动过程。

---

## 手动方法（如果 @kayvan/markdown-tree-parser 不可用或用户指示手动方法）

### 任务说明

1. 识别文档和目标位置

- 确定要分片的文档（用户提供的路径）
- 在 `docs/` 下创建一个与文档同名（不带扩展名）的新文件夹
- 示例：`docs/prd.md` → 创建文件夹 `docs/prd/`

2. 解析和提取部分

关键代理分片规则：

1. 读取整个文档内容
2. 识别所有二级标题（## 标题）
3. 对于每个二级标题：
   - 提取部分标题和所有内容，直到下一个二级标题
   - 包含所有子部分、代码块、图表、列表、表格等
   - 对以下内容要格外小心：
     - 围栏代码块 (````) - 确保捕获完整的代码块，包括结束反引号，并考虑可能误导的二级标题，这些二级标题实际上是围栏部分示例的一部分
     - Mermaid 图表 - 保留完整的图表语法
     - 嵌套的 Markdown 元素
     - 可能在代码块中包含 ## 的多行内容

关键：使用理解 Markdown 上下文的正确解析。代码块中的 ## “不是”节标题。]]

### 3. 创建单独文件

对于每个提取的部分：

1. **生成文件名**：将部分标题转换为小写-短划线-格式
   - 删除特殊字符
   - 将空格替换为短划线
   - 示例：“## 技术栈”→ `tech-stack.md`

2. **调整标题级别**：
   - 二级标题在新分片文档中变为一级标题（# 而不是 ##）
   - 所有子节级别降低 1：

   ```txt
     - ### → ##
     - #### → ###
     - ##### → ####
     - 等等。
   ```

3. **写入内容**：将调整后的内容保存到新文件

### 4. 创建索引文件

在分片文件夹中创建一个 `index.md` 文件，其中：

1. 包含原始一级标题和第一个二级标题之前的任何内容
2. 列出所有分片文件及其链接：

```markdown
# 原始文档标题

[原始引言内容（如果有）]

## 部分

- [部分名称 1](./section-name-1.md)
- [部分名称 2](./section-name-2.md)
- [部分名称 3](./section-name-3.md)
  ...
```

### 5. 保留特殊内容

1. **代码块**：必须捕获完整的代码块，包括：

   ```language
   内容
   ```

2. **Mermaid 图表**：保留完整的语法：

   ```mermaid
   graph TD
   ...
   ```

3. **表格**：保持正确的 Markdown 表格格式

4. **列表**：保持缩进和嵌套

5. **内联代码**：保留反引号

6. **链接和引用**：保持所有 Markdown 链接不变

7. **模板标记**：如果文档包含 {{占位符}}，请完全保留

### 6. 验证

分片后：

1. 验证所有部分是否已提取
2. 检查是否没有内容丢失
3. 确保标题级别已正确调整
4. 确认所有文件是否已成功创建

### 7. 报告结果

提供摘要：

```text
文档已成功分片：
- 来源：[原始文档路径]
- 目的地：docs/[文件夹名称]/
- 创建的文件：[计数]
- 部分：
  - section-name-1.md：“部分标题 1”
  - section-name-2.md：“部分标题 2”
  ...
```

## 重要说明

- 永远不要修改实际内容，只调整标题级别
- 保留所有格式，包括重要的空白
- 处理包含 ## 符号的代码块中的部分等边缘情况
- 确保分片是可逆的（可以从分片重建原始文件）