# Coding Conventions for cop-lens Project

## Comment Language
- **All comments must be written in English**
- Code comments, JSDoc, documentation comments should all use English
- This includes:
  - Class descriptions
  - Method descriptions
  - Inline comments
  - TODO comments
  - Function parameter descriptions

## Logging
- **No emojis in log messages**
- Console logs should be plain text only
- Examples:
  - ✅ `console.log("Analyzing project at: " + path)`
  - ❌ `console.log("🎯 Analyzing project at: " + path)`
  - ✅ `console.log("Found root node: " + nodeId)`
  - ❌ `console.log("🌳 Found root node: " + nodeId)`

## Examples

### Good:
```javascript
/**
 * Analyzes the entire project directory
 * @param {string} dir - Directory to analyze
 * @returns {Object} Dependency graph
 */
analyzeProject(dir) {
    console.log("Starting analysis...");
    // Process files
    console.log("Analysis complete");
}
```

### Bad:
```javascript
/**
 * プロジェクト全体を分析
 * @param {string} dir - 分析するディレクトリ
 * @returns {Object} 依存グラフ
 */
analyzeProject(dir) {
    console.log("🎯 分析開始...");
    // ファイルを処理
    console.log("✅ 分析完了");
}
```

## Note
These conventions should be applied to all new code and when modifying existing code.
