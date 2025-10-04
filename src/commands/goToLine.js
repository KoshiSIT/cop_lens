const vscode = require("vscode");

/**
 * Go to a specific line in the active text editor
 * @param {number} lineNumber - The line number to navigate to (1-based)
 */
function goToLine(lineNumber) {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        return;
    }
    // initialize to first line if no editor or invalid line number
    const line = Math.max(0, (lineNumber || 1) - 1);
    const position = new vscode.Position(line, 0);
    
    // Get the full line range
    const lineRange = editor.document.lineAt(line).range;
    
    // move cursor to the line
    editor.selection = new vscode.Selection(position, position);
    
    // display the line in the center of the view
    editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter,
    );
    
    // ✨ ハイライト追加
    const highlightDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
        border: '2px solid',
        borderColor: new vscode.ThemeColor('editor.findMatchBorder'),
        isWholeLine: true
    });
    
    // Apply highlight
    editor.setDecorations(highlightDecoration, [lineRange]);
    
    // Remove highlight after 2 seconds
    setTimeout(() => {
        highlightDecoration.dispose();
    }, 2000);
    
    console.log(`Navigated to line ${line + 1} with highlight`);
}

/**
 * Register the goToLine command in the VSCode extension
 * @param {vscode.ExtensionContext} context - The extension context
 */
function setupGoToLine(context) {
    const disposable = vscode.commands.registerCommand(
        "cop-lens.goToLine",
        goToLine,
    );
    context.subscriptions.push(disposable);
}

module.exports = {
    setupGoToLine,
};
