const vscode = require("vscode");

/**
 * Go to a specific line in the active text editor or a specified file
 * @param {number|object} lineNumberOrOptions - Line number (1-based) or options object {line, file}
 */
async function goToLine(lineNumberOrOptions) {
    let lineNumber;
    let filePath = null;
    
    // Handle both old API (just line number) and new API (options object)
    if (typeof lineNumberOrOptions === 'object') {
        lineNumber = lineNumberOrOptions.line;
        filePath = lineNumberOrOptions.file;
    } else {
        lineNumber = lineNumberOrOptions;
    }
    
    let editor = vscode.window.activeTextEditor;
    
    // If file path is specified and different from current file, open it
    if (filePath && (!editor || editor.document.uri.fsPath !== filePath)) {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            editor = await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
            console.error('Error opening file:', error);
            return;
        }
    }

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
    
    // Add highlight decoration
    const highlightDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
        border: '2px solid',
        borderColor: new vscode.ThemeColor('editor.findMatchBorder'),
        isWholeLine: true
    });
    
    // Apply highlight
    editor.setDecorations(highlightDecoration, [lineRange]);
    
    // Remove highlight after 1.5 seconds
    setTimeout(() => {
        highlightDecoration.dispose();
    }, 1500);
    
    console.log(`Navigated to line ${line + 1} with highlight (1.5s)`);
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
