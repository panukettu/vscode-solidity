import * as vscode from "vscode";
import {
  CodelensProvider,
  getKeccakCommand,
  getSignatureCommand,
} from "../codeActionProviders/lensProvider";

export function extraSubscriptions(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "solidity", scheme: "file" },
      new CodelensProvider()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("solidity.enableCodeLens", () => {
      vscode.workspace
        .getConfiguration("solidity")
        .update("enableCodeLens", true, true);
    }),
    vscode.commands.registerCommand("solidity.disableCodeLens", () => {
      vscode.workspace
        .getConfiguration("solidity")
        .update("enableCodeLens", false, true);
    }),
    getSignatureCommand(),
    getKeccakCommand()
  );

  // vscode.commands.registerCommand("solidity.lens.funcSig", (args: any) => {
  //   vscode.window.showInformationMessage(
  //     `CodeLens action clicked with args=${args}`
  //   );
  // });
  /* -------------------------------------------------------------------------- */
  /*                                     new                                    */
  /* -------------------------------------------------------------------------- */

  // context.subscriptions.push(
  //   vscode.languages.registerCodeActionsProvider("solidity", new Emojizer(), {
  //     providedCodeActionKinds: Emojizer.providedCodeActionKinds,
  //   })
  // );

  // const emojiDiagnostics = vscode.languages.createDiagnosticCollection("emoji");
  // context.subscriptions.push(emojiDiagnostics);

  // subscribeToDocumentChanges(context, emojiDiagnostics);

  // context.subscriptions.push(
  //   vscode.languages.registerCodeActionsProvider("solidity", new Emojinfo(), {
  //     providedCodeActionKinds: Emojinfo.providedCodeActionKinds,
  //   })
  // );
}
