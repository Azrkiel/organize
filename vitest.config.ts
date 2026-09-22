import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // See lib/test-support/server-only-stub.ts for why this is needed.
      "server-only": path.resolve(__dirname, "lib/test-support/server-only-stub.ts"),
    },
  },
  test: { environment: "node", include: ["**/*.test.ts"], exclude: ["node_modules", ".next"] },
});
