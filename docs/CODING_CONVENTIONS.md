# COP-Lens Coding Conventions

## Comment Rules

### Language
- **All comments must be in English**
- Use clear, technical English
- Avoid colloquial expressions

### Style
- **No emojis** in code comments (🚫 ❌ ✅ 🎉 etc.)
- Use proper punctuation
- Keep comments concise and meaningful

### Comment Types

#### 1. File-level Documentation
```javascript
/**
 * Graph Renderer for COP-lens
 * Converts ObjectDependencyDetector results to Cytoscape.js visualization
 */
```

#### 2. Class/Function Documentation (JSDoc)
```javascript
/**
 * Apply hierarchy levels to nodes for positioning
 * @param {Array} nodes - Array of node objects
 * @param {Map} hierarchyLevels - Map of nodeId -> level
 * @returns {Array} Nodes with hierarchy level added
 */
```

#### 3. Inline Comments
```javascript
// Support both 'hierarchy' and 'hierarchyLevels' naming
const hierarchyLevels = dependencyGraph.hierarchy || dependencyGraph.hierarchyLevels;
```

#### 4. TODO Comments
```javascript
// TODO: Add support for custom layouts
// FIXME: Handle edge case when nodes is empty
// NOTE: This assumes layers are always in layers.js
```

### Bad Examples

```javascript
// 各種Detectorを統合  ❌ Japanese
// 🎉 Success!  ❌ Emoji
// ← ここで分類される  ❌ Japanese with arrow
```

### Good Examples

```javascript
// Integrate all detectors
// Process completed successfully
// Classification happens here
```

## Naming Conventions

### Variables
- camelCase for variables and functions
- PascalCase for classes
- UPPER_SNAKE_CASE for constants

```javascript
const maxRetries = 3;           // Good
const MAX_RETRY_COUNT = 3;      // Good for constants
class GraphRenderer { }         // Good
```

### Files
- camelCase for JavaScript files
- Descriptive names reflecting content

```javascript
graphRenderer.js          // Good
copAnalyzer.js           // Good
babelLayerDetector.js    // Good
```

## Code Organization

### Import Order
1. Node.js built-in modules
2. External dependencies
3. Local modules (ordered by path depth)

```javascript
const path = require('path');
const fs = require('fs');

const babel = require('@babel/parser');

const { LayerDetector } = require('./layerDetector');
const { COPAnalyzer } = require('../analyzer/copAnalyzer');
```

### Spacing
- Blank line between logical sections
- No blank line after opening brace
- One blank line before closing brace (optional)

## Error Handling

```javascript
try {
    // Main logic
} catch (error) {
    console.error(`[ModuleName] Error message: ${error.message}`);
    // Graceful degradation or rethrow
}
```

## Logging

Use descriptive prefixes:
```javascript
console.log('[UnifiedAnalyzer] Analysis complete');
console.error('[COPAnalyzer] Parse error in file');
console.warn('[GraphRenderer] Missing hierarchy data');
```

## Documentation

- README.md: User-facing documentation (English)
- docs/*.md: Technical documentation (English)
- JSDoc comments: API documentation (English)
