当 `project-analysis.xml` 文件过大时，有几种处理方法：

## 1. 分模块扁平化（推荐）

将大型项目按模块分别扁平化：

````bash path=terminal mode=EDIT
# 分析核心模块
npx bmad-method flatten --input ./src/core --output core-analysis.xml

# 分析API模块
npx bmad-method flatten --input ./src/api --output api-analysis.xml

# 分析前端模块
npx bmad-method flatten --input ./src/frontend --output frontend-analysis.xml

# 分析配置和文档
npx bmad-method flatten --input ./docs --output docs-analysis.xml
npx bmad-method flatten --input ./config --output config-analysis.xml
````

## 2. 使用 .gitignore 优化过滤

创建专门的忽略文件来排除不必要的内容：

````gitignore path=.bmadignore mode=EDIT
# 排除大型依赖目录
node_modules/
vendor/
.git/
dist/
build/

# 排除测试文件（如果不需要分析）
**/*test*
**/*spec*
**/tests/

# 排除文档和示例（如果不需要）
docs/
examples/
samples/

# 排除配置文件
*.config.js
*.config.ts
webpack.config.*
````

## 3. 分阶段分析策略

根据项目大小采用不同策略：

````markdown path=analysis-strategy.md mode=EDIT
# 大型项目分析策略

## 第一阶段：架构概览
```bash
# 只分析主要架构文件
npx bmad-method flatten --input ./src --output architecture-overview.xml
# 排除测试、示例、文档
```

## 第二阶段：核心功能
```bash
# 分析核心业务逻辑
npx bmad-method flatten --input ./src/core --output core-functionality.xml
```

## 第三阶段：具体模块
```bash
# 根据需要分析特定模块
npx bmad-method flatten --input ./src/payment --output payment-module.xml
```
````

## 4. 使用 Gemini Web 的分批上传

对于超大文件，可以分批处理：

````markdown path=batch-analysis.md mode=EDIT
# 分批分析工作流

## 方法 1: 按功能模块分批
1. 上传 core-analysis.xml → 分析核心架构
2. 上传 api-analysis.xml → 分析 API 设计
3. 上传 frontend-analysis.xml → 分析前端架构

## 方法 2: 按层次分批
1. 上传配置和文档 → 了解项目概况
2. 上传核心业务逻辑 → 理解主要功能
3. 上传工具和辅助模块 → 完善理解

## 在 Gemini Web 中的使用
- 每次上传一个模块的 XML
- 使用 @analyst → *document-project 分析
- 最后整合所有分析结果
````

## 5. 优化扁平化参数

根据代码库检索结果，扁平化工具有智能过滤功能：

````bash path=terminal mode=EDIT
# 检查当前项目大小和文件分布
npx bmad-method flatten --dry-run --input /path/to/project

# 查看会生成多大的文件和包含哪些内容
# 根据输出调整策略
````

## 6. 内存和性能考虑

基于 `memory-profiler.js` 的建议：

````markdown path=performance-tips.md mode=EDIT
# 性能优化建议

## 文件大小限制
- 单个 XML 文件建议不超过 100MB
- 如果超过 50MB，考虑分模块处理
- 超过 500MB 的项目必须分批处理

## 内存使用
- 大文件会使用流式处理（>10MB）
- 监控内存使用，避免超过 500MB 峰值
- 分批处理可以减少内存压力

## 令牌估算
- 1 令牌 ≈ 4 字符
- Gemini 上下文限制：1M+ 令牌
- 建议单次分析不超过 800K 令牌
````

## 7. 实际处理示例

````bash path=large-project-example.sh mode=EDIT
#!/bin/bash
# 大型项目分析脚本

echo "分析大型开源项目..."

# 1. 先分析项目结构和配置
npx bmad-method flatten --input ./package.json --input ./README.md --input ./docs --output project-overview.xml

# 2. 分析核心源码（排除测试）
npx bmad-method flatten --input ./src --output src-analysis.xml

# 3. 如果 src 还是太大，进一步细分
if [ -d "./src/core" ]; then
    npx bmad-method flatten --input ./src/core --output core-analysis.xml
fi

if [ -d "./src/api" ]; then
    npx bmad-method flatten --input ./src/api --output api-analysis.xml
fi

echo "分析完成，生成了多个 XML 文件用于分批上传"
````

## 推荐处理流程

1. **评估项目大小**：先运行 `--dry-run` 查看会生成多大的文件
2. **选择分割策略**：按模块、按功能或按层次分割
3. **分批分析**：在 Gemini Web 中分批上传和分析
4. **整合结果**：最后将各部分分析结果整合成完整的项目文档

这样可以有效处理大型项目，同时保持分析的完整性和准确性。
