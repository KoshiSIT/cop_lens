const babel = require("@babel/core");
const traverse = require("@babel/traverse").default;

const code = `
const layerOnlineEditor = new Layer("onlineEditor");
EMA.deploy(layerOnlineEditor);
`;

const ast = babel.parse(code);

traverse(ast, {
    CallExpression: (path) => {
        if (path.node.callee.type === 'MemberExpression' &&
            path.node.callee.object.name === 'EMA' &&
            path.node.callee.property.name === 'deploy') {
            
            console.log('=== EMA.deploy() found ===');
            console.log('Arguments:', path.node.arguments);
            console.log('Arg[0] type:', path.node.arguments[0].type);
            console.log('Arg[0] name:', path.node.arguments[0].name);
            console.log('Arg[0] full:', JSON.stringify(path.node.arguments[0], null, 2));
        }
    }
});
