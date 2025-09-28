import next from "eslint-config-next";

export default [
  ...next,
  {
    ignores: [
      "components/**/*",
      "ethos-pages/**/*",
      "hooks/**/*",
      "api/**/*",
      "utils/**/*",
    ],
  },
  {
    languageOptions: {
      globals: {
        process: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
    },
  },
];
