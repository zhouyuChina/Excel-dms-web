import tseslint from "typescript-eslint";
import react from "@eslint-react/eslint-plugin";
export default [
  { ignores: ["dist/**", "server/dist/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { react },
    languageOptions: {
      parserOptions: { project: false, sourceType: "module", ecmaFeatures: { jsx: true } }
    },
    rules: {
      "react/hook-use-state": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off"
    },
  },
];
