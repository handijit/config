import { format } from "prettier";
import { describe, expect, test } from "vitest";

import defaultStyle, { app, library } from "../lib/prettier";
import appStyle from "../lib/prettier-app";

const SOURCE = "const pick = (x) => ({ name: 'a', list: [1, 2] })\n";

describe("prettier styles", () => {
  test("should spell out the library style (NPM_PACKAGE.md section 13)", () => {
    expect(library).toEqual({
      semi: true,
      singleQuote: false,
      trailingComma: "es5",
      printWidth: 80,
      tabWidth: 2,
      arrowParens: "always",
    });
    expect(defaultStyle).toBe(library);
  });

  test("should spell out the app style (NEXT_FRONTEND.md section 11)", () => {
    expect(app).toEqual({
      semi: true,
      singleQuote: true,
      trailingComma: "all",
      printWidth: 100,
      tabWidth: 2,
      arrowParens: "avoid",
    });
    expect(appStyle).toBe(app);
  });

  test("should format code the way each style says", async () => {
    expect(await format(SOURCE, { ...library, parser: "typescript" })).toBe(
      'const pick = (x) => ({ name: "a", list: [1, 2] });\n'
    );
    expect(await format(SOURCE, { ...app, parser: "typescript" })).toBe(
      "const pick = x => ({ name: 'a', list: [1, 2] });\n"
    );
  });
});
