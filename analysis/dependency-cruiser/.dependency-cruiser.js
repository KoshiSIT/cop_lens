/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'warn',
      comment: 'Circular dependencies detected',
      from: {},
      to: { circular: true }
    }
  ],
  options: {
    includeOnly: '^(src|examples|test|lib)',
    doNotFollow: {
      path: ['node_modules', 'analysis', 'dev-tools', '.vscode']
    }
  }
};
