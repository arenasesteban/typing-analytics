const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
    const defaultExternals = Array.isArray(options.externals) ? options.externals : [];

    const [, ...preservedExternals] = defaultExternals;

    return {
        ...options,
        externals: [
            nodeExternals({
                allowlist: ['@typing-analytics/typing-core'],
                importType: 'module',
            }),
            ...preservedExternals,
        ],
    };
};
