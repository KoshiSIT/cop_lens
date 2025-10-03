#!/bin/bash

# COP-lens Dependency Analysis Script
# Usage: ./analyze-dependencies.sh [type]
# Types: basic, full, report, validate

ANALYSIS_DIR="analysis/dependency-cruiser"
CONFIG_FILE="$ANALYSIS_DIR/.dependency-cruiser.js"

case "$1" in
  "basic")
    echo "🔍 Basic dependency analysis (src only)..."
    npx depcruise src --config $CONFIG_FILE --output-type dot | dot -T svg > $ANALYSIS_DIR/src-dependencies.svg
    echo "✅ Generated: $ANALYSIS_DIR/src-dependencies.svg"
    ;;
    
  "full")
    echo "🔍 Full project dependency analysis..."
    npx depcruise . --config $CONFIG_FILE --output-type dot | dot -T svg > $ANALYSIS_DIR/full-dependencies.svg
    echo "✅ Generated: $ANALYSIS_DIR/full-dependencies.svg"
    ;;
    
  "report")
    echo "📊 Generating HTML report..."
    npx depcruise . --config $CONFIG_FILE --output-type html > $ANALYSIS_DIR/dependency-report.html
    echo "✅ Generated: $ANALYSIS_DIR/dependency-report.html"
    ;;
    
  "validate")
    echo "🔍 Validating dependencies..."
    npx depcruise . --config $CONFIG_FILE --validate
    ;;
    
  "cop-focus")
    echo "🎯 COP-specific analysis (EMA.js integration)..."
    npx depcruise src examples --config $CONFIG_FILE --focus "src/parser/.*" --output-type dot | dot -T svg > $ANALYSIS_DIR/cop-focused.svg
    echo "✅ Generated: $ANALYSIS_DIR/cop-focused.svg"
    ;;
    
  *)
    echo "📋 COP-lens Dependency Analysis Tool"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  basic     - Analyze src directory only"
    echo "  full      - Analyze entire project"
    echo "  report    - Generate interactive HTML report"
    echo "  validate  - Check for circular dependencies"
    echo "  cop-focus - Focus on COP parser modules"
    echo ""
    echo "Output directory: $ANALYSIS_DIR"
    ;;
esac
