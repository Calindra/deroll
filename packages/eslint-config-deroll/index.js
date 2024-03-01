module.exports = {
    extends: [
        "plugin:@typescript-eslint/recommended-type-checked",
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
        "no-unused-vars": "off",
        "no-constant-condition": "off",
    },
};
