import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"], // for prisma
  outDir: "build",
  target: "node18",
  tsconfig: "tsconfig.json",
  clean: true,
});
