/**
 * ハイライトスタイルのバリエーション
 * 
 * src/commands/goToLine.js で使用できる異なるスタイル
 */

// 🎨 スタイル1: 標準（現在の実装）
const standardHighlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
    border: '2px solid',
    borderColor: new vscode.ThemeColor('editor.findMatchBorder'),
    isWholeLine: true
});

// 🎨 スタイル2: より目立つ
const boldHighlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 200, 0, 0.3)',  // 黄色半透明
    border: '3px solid rgba(255, 200, 0, 0.8)', // 太い黄色ボーダー
    isWholeLine: true
});

// 🎨 スタイル3: 青色のフラッシュ
const blueFlashHighlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(0, 120, 255, 0.2)',  // 青色半透明
    border: '2px solid rgba(0, 120, 255, 0.6)',
    isWholeLine: true
});

// 🎨 スタイル4: 緑色のパルス
const greenPulseHighlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(0, 200, 100, 0.25)', // 緑色半透明
    border: '2px dashed rgba(0, 200, 100, 0.7)', // 点線ボーダー
    isWholeLine: true
});

// 🎨 スタイル5: 左側バー（ブレークポイント風）
const sidebarHighlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 200, 0, 0.15)',
    borderLeft: '4px solid rgba(255, 200, 0, 1)', // 左側に太いバー
    isWholeLine: true
});

// 🎨 スタイル6: グローエフェクト
const glowHighlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
    border: '1px solid rgba(100, 200, 255, 0.8)',
    outline: '3px solid rgba(100, 200, 255, 0.3)', // 外側のグロー
    isWholeLine: true
});

// 🎨 スタイル7: テキストハイライト（行全体ではなく）
const textOnlyHighlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 255, 0, 0.4)',  // 黄色マーカー
    isWholeLine: false  // テキスト部分のみ
});

// 🎨 スタイル8: アニメーション風（複数段階）
const animatedHighlight = {
    step1: vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 200, 0, 0.5)',
        isWholeLine: true
    }),
    step2: vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 200, 0, 0.3)',
        isWholeLine: true
    }),
    step3: vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 200, 0, 0.1)',
        isWholeLine: true
    })
};

/**
 * アニメーション付きハイライトの使用例
 */
function animatedGoToLine(editor, lineRange) {
    // Step 1: 濃い (0-500ms)
    editor.setDecorations(animatedHighlight.step1, [lineRange]);
    
    setTimeout(() => {
        // Step 2: 中間 (500-1000ms)
        animatedHighlight.step1.dispose();
        editor.setDecorations(animatedHighlight.step2, [lineRange]);
        
        setTimeout(() => {
            // Step 3: 薄い (1000-1500ms)
            animatedHighlight.step2.dispose();
            editor.setDecorations(animatedHighlight.step3, [lineRange]);
            
            setTimeout(() => {
                // 消去 (1500-2000ms)
                animatedHighlight.step3.dispose();
            }, 500);
        }, 500);
    }, 500);
}

module.exports = {
    standardHighlight,
    boldHighlight,
    blueFlashHighlight,
    greenPulseHighlight,
    sidebarHighlight,
    glowHighlight,
    textOnlyHighlight,
    animatedHighlight
};
