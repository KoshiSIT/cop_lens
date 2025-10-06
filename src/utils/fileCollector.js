const fs = require('fs');
const path = require('path');

/**
 * FileCollector - プロジェクト全体のファイル収集ユーティリティ
 */
class FileCollector {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.defaultExcludes = [
            'node_modules',
            '.git',
            'dist',
            'build',
            'coverage',
            '.vscode',
            '.serena',
            'lib'
        ];
        
        // Load .copignore file if exists
        this.userExcludes = this._loadCopIgnore();
    }
    
    /**
     * Load patterns from .copignore file
     * @private
     * @returns {Array<string>} Exclude patterns from .copignore
     */
    _loadCopIgnore() {
        const copignorePath = path.join(this.projectRoot, '.copignore');
        
        if (!fs.existsSync(copignorePath)) {
            return [];
        }
        
        try {
            const content = fs.readFileSync(copignorePath, 'utf8');
            const patterns = content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#')); // Ignore empty lines and comments
            
            console.log(`[FileCollector] Loaded .copignore: ${patterns.length} patterns`);
            return patterns;
        } catch (error) {
            console.error(`[FileCollector] Error reading .copignore:`, error.message);
            return [];
        }
    }

    /**
     * プロジェクト全体からJavaScriptファイルを再帰的に収集
     * @param {Array<string>} additionalExcludes - 追加の除外パターン
     * @returns {Array<string>} ファイルパスの配列
     */
    collectAllJavaScriptFiles(additionalExcludes = []) {
        const excludePatterns = [...this.defaultExcludes, ...this.userExcludes, ...additionalExcludes];
        const files = [];
        
        this._traverse(this.projectRoot, files, excludePatterns);
        
        return files;
    }

    /**
     * 再帰的にディレクトリを走査
     * @private
     */
    _traverse(dir, files, excludePatterns) {
        try {
            const entries = fs.readdirSync(dir);
            
            for (const entry of entries) {
                // 除外パターンチェック
                if (this._shouldExclude(entry, excludePatterns)) {
                    continue;
                }
                
                const fullPath = path.join(dir, entry);
                
                try {
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        // サブディレクトリを再帰的に走査
                        this._traverse(fullPath, files, excludePatterns);
                    } else if (stat.isFile() && this._isJavaScriptFile(entry)) {
                        files.push(fullPath);
                    }
                } catch (statError) {
                    // ファイル/ディレクトリへのアクセスエラーは無視
                    continue;
                }
            }
        } catch (error) {
            console.error(`[FileCollector] Error reading directory ${dir}:`, error.message);
        }
    }

    /**
     * 除外すべきかチェック
     * @private
     */
    _shouldExclude(entry, excludePatterns) {
        for (const pattern of excludePatterns) {
            if (entry.includes(pattern)) {
                return true;
            }
            
            // ワイルドカードパターン対応
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                if (regex.test(entry)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * JavaScriptファイルかチェック
     * @private
     */
    _isJavaScriptFile(filename) {
        if (!filename.endsWith('.js')) {
            return false;
        }
        
        // テストファイルを除外
        if (filename.includes('.test.') || filename.includes('.spec.')) {
            return false;
        }
        
        return true;
    }

    /**
     * ディレクトリ内のファイルのみ収集（非再帰）
     * @param {string} dir - ディレクトリパス
     * @returns {Array<string>} ファイルパスの配列
     */
    collectFilesInDirectory(dir) {
        const files = [];
        
        try {
            const entries = fs.readdirSync(dir);
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                
                try {
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isFile() && this._isJavaScriptFile(entry)) {
                        files.push(fullPath);
                    }
                } catch (statError) {
                    continue;
                }
            }
        } catch (error) {
            console.error(`[FileCollector] Error reading directory ${dir}:`, error.message);
        }
        
        return files;
    }
}

module.exports = { FileCollector };
