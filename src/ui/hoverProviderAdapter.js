const vscode = require("vscode");
const { HoverProvider } = require("../features/hoverProvider");

/**
 * COPHoverProviderAdapter - 既存のCOPHoverProviderを新しいHoverProviderに適合
 * 
 * VSCodeのHoverProviderインターフェースを実装し、
 * 内部で新しいHoverProviderを使用する
 */
class COPHoverProviderAdapter {
    constructor() {
        this.analysisResult = null;
        this.hoverProvider = null;
    }

    /**
     * 解析結果を設定
     * @param {Object} analysisResult - COPAnalyzerからの解析結果
     */
    setAnalysisResult(analysisResult) {
        this.analysisResult = analysisResult;
        this.hoverProvider = new HoverProvider(analysisResult);
    }

    /**
     * VSCodeのHover情報を提供
     * @param {vscode.TextDocument} document - ドキュメント
     * @param {vscode.Position} position - カーソル位置
     * @returns {vscode.Hover|null} Hover情報
     */
    provideHover(document, position) {
        if (!this.hoverProvider) {
            return null;
        }

        // VSCodeのPositionを{line, character}形式に変換
        const pos = {
            line: position.line,
            character: position.character
        };

        const hoverInfo = this.hoverProvider.provideHover(pos);
        if (!hoverInfo) {
            return null;
        }

        // Markdownコンテンツを作成
        const markdown = new vscode.MarkdownString(hoverInfo.contents);
        markdown.isTrusted = true;

        // VSCodeのHoverオブジェクトを返す
        return new vscode.Hover(markdown);
    }
}

module.exports = { COPHoverProviderAdapter };
