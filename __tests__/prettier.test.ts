import { format } from "prettier";
import { describe, expect, it } from "vitest";

import library, { app } from "../lib/prettier";
import appDefault from "../lib/prettier-app";

const SOURCE =
  "const pick = (list) => list.map((item) => ({ name: item.name, value: 'value' }))\n";

describe("the Prettier presets", () => {
  it("format the library style: double quotes, es5 commas, 80 columns", async () => {
    expect(await format(SOURCE, { ...library, parser: "typescript" })).toBe(
      'const pick = (list) =>\n  list.map((item) => ({ name: item.name, value: "value" }));\n'
    );
  });

  it("format the app style: single quotes, every comma, 100 columns, bare arrow parameters", async () => {
    expect(await format(SOURCE, { ...app, parser: "typescript" })).toBe(
      "const pick = list => list.map(item => ({ name: item.name, value: 'value' }));\n"
    );
    expect(
      await format(
        "call(aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, cccccccccccccccccccccc)\n",
        {
          ...app,
          parser: "typescript",
        }
      )
    ).toMatch(/cccccccccccccccccccccc,\n\);/);
  });

  it("offer the app style as a default export for package.json", () => {
    expect(appDefault).toBe(app);
  });
});
