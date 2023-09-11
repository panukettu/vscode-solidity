import * as vscode from "vscode";

const functionRegexp = () => new RegExp(/(function.*?\()/g);
const keccak256Regexp = () => new RegExp(/(?<=keccak256\(")(.*?)(?="\))/g);
export const getSignatureCommand = () =>
  vscode.commands.registerCommand("solidity.lens.funcSig", async (...args) => {
    const result: string = await vscode.commands.executeCommand(
      "solidity.server.lens.funcSig",
      ...args
    );

    return vscode.window.showInformationMessage(result);
  });
export const getKeccakCommand = () =>
  vscode.commands.registerCommand(
    "solidity.lens.keccak256",
    async (...args) => {
      const result: string = await vscode.commands.executeCommand(
        "solidity.server.lens.keccak256",
        ...args
      );

      return vscode.window.showInformationMessage(result);
    }
  );
/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {
  private codeLenses: vscode.CodeLens[] = [];
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor() {
    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (
      vscode.workspace.getConfiguration("solidity").get("enableCodeLens", true)
    ) {
      this.codeLenses = [];
      const regex = functionRegexp();
      const text = document.getText();
      let matches;
      while ((matches = regex.exec(text)) !== null) {
        const line = document.lineAt(document.positionAt(matches.index).line);
        const indexOf = line.text.indexOf(matches[0]);
        const position = new vscode.Position(line.lineNumber, indexOf);
        const range = document.getWordRangeAtPosition(
          position,
          functionRegexp()
        );
        if (range) {
          this.codeLenses.push(
            new vscode.CodeLens(range, {
              title: "selector",
              tooltip: "Preview the bytes4 selector",
              command: "solidity.lens.funcSig",
              arguments: [document, range],
            })
          );
        }
      }

      return this.codeLenses;
    }
    return [];
  }

  public async resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ) {
    if (
      vscode.workspace.getConfiguration("solidity").get("enableCodeLens", true)
    ) {
      return codeLens;
    }
    return null;
  }
}
