import { library } from "@handijit/config/dependency-cruiser";

export default library({
  layers: {
    shared: { environment: "shared", path: "^lib/(index\\.ts$|shared/)" },
    main: { environment: "main" },
    preload: { environment: "preload" },
    renderer: { environment: "renderer" },
  },
  entries: ["^lib/renderer\\.ts$"],
});
