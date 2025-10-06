const path = require('path');
const fs = require('fs');

// Simulate different file paths in same project
const projectRoot = '/Users/k_yo/develop/cop/cop-lens/examples/structured-cop';

const files = [
    path.join(projectRoot, 'main.js'),
    path.join(projectRoot, 'onlineEditorLayer.js'),
    path.join(projectRoot, 'EditorWidget.js'),
];

console.log('Project Root:', projectRoot);
console.log('\nFiles in same project:');
files.forEach(f => {
    console.log('  -', path.relative(projectRoot, f));
});

// Check how determineProjectRoot works (from extension.js)
function determineProjectRoot(filePath) {
    let currentDir = path.dirname(filePath);
    
    // Search for package.json or .git up to 5 levels
    for (let i = 0; i < 5; i++) {
        const packageJsonPath = path.join(currentDir, 'package.json');
        const gitPath = path.join(currentDir, '.git');
        
        if (fs.existsSync(packageJsonPath) || fs.existsSync(gitPath)) {
            return currentDir;
        }
        
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) break; // reached root
        currentDir = parentDir;
    }
    
    // Fallback: use directory of the file
    return path.dirname(filePath);
}

console.log('\nProject root detection:');
files.forEach(f => {
    const detected = determineProjectRoot(f);
    const isSame = detected === projectRoot;
    console.log(`  ${path.basename(f)}: ${detected}`);
    console.log(`    Same? ${isSame ? '✓' : '✗ DIFFERENT!'}`);
});
