/**
 * Project utilities for determining project root
 */

const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

/**
 * Determine project root using hybrid approach
 * @param {vscode.TextDocument} document - Current document
 * @returns {string} Project root path
 */
function determineProjectRoot(document) {
    const currentFilePath = document.fileName;

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
        console.log("No workspace folder found");
        return findManifestFromFile(currentFilePath);
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
    console.log(`Workspace root: ${workspaceRoot}`);

    // Search for manifest file within workspace
    let dir = path.dirname(currentFilePath);
    while (dir.startsWith(workspaceRoot)) {
        if (fs.existsSync(path.join(dir, "package.json"))) {
            console.log(`Found package.json at: ${dir}`);
            return dir;
        }

        if (fs.existsSync(path.join(dir, ".git"))) {
            console.log(`Found .git at: ${dir}`);
            return dir;
        }

        if (dir === workspaceRoot) {
            console.log("Reached workspace root without finding manifest");
            break;
        }

        dir = path.dirname(dir);
    }
    return workspaceRoot;
}

/**
 * Find manifest file by traversing up from file path
 * @param {string} filePath - Starting file path
 * @returns {string} Directory containing manifest or file's directory
 */
function findManifestFromFile(filePath) {
    let dir = path.dirname(filePath);
    const root = path.parse(dir).root;

    while (dir !== root) {
        // Check for package.json
        if (fs.existsSync(path.join(dir, "package.json"))) {
            console.log(`Found package.json at: ${dir}`);
            return dir;
        }

        // Check for .git
        if (fs.existsSync(path.join(dir, ".git"))) {
            console.log(`Found .git at: ${dir}`);
            return dir;
        }

        dir = path.dirname(dir);
    }

    // Fallback: file's directory
    console.log(
        `No manifest found, using file directory: ${path.dirname(filePath)}`,
    );
    return path.dirname(filePath);
}

module.exports = {
    determineProjectRoot,
    findManifestFromFile,
};
