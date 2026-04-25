import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Coverage is reported but not enforced. The codebase mixes
      // unit-tested helpers with UI, tRPC routers, and schema modules
      // that are validated by integration and manual testing, so a single
      // global threshold produces more noise than signal. Re-introduce
      // thresholds once dedicated test coverage targets are decided.
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
