import type { Config } from "prettier";

/**
 * The library style (NPM_PACKAGE.md): what seven of the eight `@handijit/*` packages use.
 * Double quotes and an 80-column line read well in a diff of plain TypeScript.
 */
const library: Config = {
  semi: true,
  singleQuote: false,
  trailingComma: "es5",
  printWidth: 80,
  tabWidth: 2,
  arrowParens: "always",
};

/**
 * The app style (NEXT_FRONTEND.md, ELECTRON_APP.md): the web's, shared by the Next.js sites,
 * the desktop programs and `@handijit/ui`. JSX reads better on a 100-column line.
 */
const app: Config = {
  semi: true,
  singleQuote: true,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  arrowParens: "avoid",
};

export { app, library };
export default library;
