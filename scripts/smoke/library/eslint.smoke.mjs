import { library } from "@handijit/config/eslint";

export default library({
  rootDir: import.meta.dirname,
  layers: {
    shared: {
      environment: "shared",
      files: ["lib/index.ts", "lib/shared/**/*.ts"],
    },
    main: { environment: "main" },
    preload: { environment: "preload" },
    renderer: { environment: "renderer" },
  },
});
