import nextEslintConfig from "eslint-config-next";

/** Native flat config from `eslint-config-next` (avoid FlatCompat + circular config in ESLint 9). */
const eslintConfig = [...nextEslintConfig];

export default eslintConfig;
