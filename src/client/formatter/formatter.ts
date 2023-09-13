import * as vscode from "vscode";
import * as prettier from "./prettierFormatter";
import * as forge from "./forgeFormatter";

export async function formatDocument(
  document: vscode.TextDocument,
  context: vscode.ExtensionContext
): Promise<vscode.TextEdit[]> {
  const formatter = vscode.workspace
    .getConfiguration("solidity")
    .get<string>("formatter");
  switch (formatter) {
    case "prettier":
      return await prettier.formatDocument(document, context);
    case "forge":
      return await forge.formatDocument(document, context);
    default:
      return null;
  }
}
