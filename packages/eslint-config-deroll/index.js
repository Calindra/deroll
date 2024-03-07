module.exports = {
    extends: [
        "plugin:@typescript-eslint/recommended",
        "turbo",
        "prettier",
    ],
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    parserOptions: {
        babelOptions: {
            presets: [],
        },
    },
    env: {
        node: true,
    },
    rules: {
        "prefer-const": "error",
        "@typescript-eslint/no-unused-vars": "off",
        "no-constant-condition": "off",
    },
};
