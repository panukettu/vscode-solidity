import { exec, execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { defineConfig, type Options } from "tsup";

export default defineConfig(async () => {
  return {
    entry: ["src/extension.ts", "src/server.ts"],
    external: ["vscode", "typescript"],
    format: "cjs",
    outDir: "./out",
    platform: "node",
    sourcemap: false,
    bundle: true,
    noExternal: [
      // /(?:[^vscode]).*?([\w\-]+)/,
      "@iarna/toml",
      "axios",
      "fs-extra",
      "glob",
      "prettier",
      "prettier-plugin-solidity",
      "solc",
      "solhint",
      "solparse-exp-jb",
      "vscode-languageclient",
      "vscode-languageserver",
      "vscode-languageserver-textdocument",
      "vscode-uri",
      "yaml-js",
    ],
    treeshake: true,
    splitting: false,
    minify: true,
    clean: true,
    async onSuccess() {
      execSync("cp ./package.json ./out/package.json");
      execSync("cp ./node_modules/@solidity-parser/parser/dist/*.tokens ./out");
      if (!existsSync("./out/antlr")) {
        mkdirSync("./out/antlr", {});
      }
      execSync(
        "cp ./node_modules/@solidity-parser/parser/dist/antlr/*.tokens ./out/antlr"
      );
    },
  };
});