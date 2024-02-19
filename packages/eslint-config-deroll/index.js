module.exports = {
    extends: ["eslint:recommended", "turbo", "prettier"],
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
