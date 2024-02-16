module.exports = {
    extends: ["eslint:recommended", "turbo", "prettier"],
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    parserOptions: {
        babelOptions: {
            presets: [],
        },
    },
    rules: {
        "prefer-const": "error",
        "no-unused-vars": "off",
    },
};
