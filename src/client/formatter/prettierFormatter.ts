import * as prettier from "prettier";
import * as vscode from "vscode";
import * as path from "path";
import * as workspaceUtil from "../workspaceUtil";

export async function formatDocument(
  document: vscode.TextDocument,
  context: vscode.ExtensionContext
): Promise<vscode.TextEdit[]> {
  const rootPath = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();

  const fileInfo = await prettier.getFileInfo(document.uri.fsPath, {
    ignorePath: path.join(rootPath, ".prettierignore"),
  });
  if (!fileInfo.ignored) {
    const source = document.getText();

    const config = await prettier.resolveConfig(document.uri.fsPath);
    if (config !== null) {
      await prettier.clearConfigCache();
    }

    const firstLine = document.lineAt(0);
    const lastLine = document.lineAt(document.lineCount - 1);
    const fullTextRange = new vscode.Range(
      firstLine.range.start,
      lastLine.range.end
    );

    const formatted = await prettier.format(source, {
      ...config,
      parser: "solidity-parse",
      plugins: [require("prettier-plugin-solidity")],
    });
    return [vscode.TextEdit.replace(fullTextRange, formatted)];
  }
}
