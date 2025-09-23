const { setupGoToLine } = require("./goToLine");

/**
 * Register all commands for the VSCode extension
 * @param {vscode.ExtensionContext} context - The extension context
 */
function setupCommands(context) {
    setupGoToLine(context);
}
module.exports = {
    setupCommands,
};
