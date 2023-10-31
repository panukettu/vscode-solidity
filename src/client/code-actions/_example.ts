// import * as vscode from "vscode";

// /** Code that is used to associate diagnostic entries with code actions. */
// export const EMOJI_MENTION = "emoji_mention";

// export const functionRange = (line: vscode.TextLine) => [
//   line.text.indexOf(EMOJI),
//   line.text.indexOf(")") + 1,
// ];

// /** String to detect in the text document. */
// const EMOJI = "function";

// /**
//  * Analyzes the text document for problems.
//  * This demo diagnostic problem provider finds all mentions of 'emoji'.
//  * @param doc text document to analyze
//  * @param emojiDiagnostics diagnostic collection
//  */
// export function refreshDiagnostics(
//   doc: vscode.TextDocument,
//   emojiDiagnostics: vscode.DiagnosticCollection
// ): void {
//   const diagnostics: vscode.Diagnostic[] = [];

//   for (let lineIndex = 0; lineIndex < doc.lineCount; lineIndex++) {
//     const lineOfText = doc.lineAt(lineIndex);
//     if (lineOfText.text.includes(EMOJI)) {
//       diagnostics.push(createDiagnostic(doc, lineOfText, lineIndex));
//     }
//   }

//   emojiDiagnostics.set(doc.uri, diagnostics);
// }

// function createDiagnostic(
//   doc: vscode.TextDocument,
//   lineOfText: vscode.TextLine,
//   lineIndex: number
// ): vscode.Diagnostic {
//   // find where in the line of that the 'emoji' is mentioned
//   const [start, end] = functionRange(lineOfText);

//   // create range that represents, where in the document the word is
//   const range = new vscode.Range(lineIndex, start, lineIndex, end + 1);

//   const diagnostic = new vscode.Diagnostic(
//     range,
//     "When you say 'emoji', do you want to find out more?",
//     vscode.DiagnosticSeverity.Hint
//   );
//   diagnostic.code = EMOJI_MENTION;
//   return diagnostic;
// }

// export function subscribeToDocumentChanges(
//   context: vscode.ExtensionContext,
//   emojiDiagnostics: vscode.DiagnosticCollection
// ): void {
//   if (vscode.window.activeTextEditor) {
//     // refreshDiagnostics(
//     //   vscode.window.activeTextEditor.document,
//     //   emojiDiagnostics
//     // );
//   }
//   // context.subscriptions.push(
//   //   vscode.window.onDidChangeActiveTextEditor((editor) => {
//   //     if (editor) {
//   //       refreshDiagnostics(editor.document, emojiDiagnostics);
//   //     }
//   //   })
//   // );

//   // context.subscriptions.push(
//   //   vscode.workspace.onDidChangeTextDocument((e) =>
//   //     refreshDiagnostics(e.document, emojiDiagnostics)
//   //   )
//   // );

//   context.subscriptions.push(
//     vscode.workspace.onDidCloseTextDocument((doc) =>
//       emojiDiagnostics.delete(doc.uri)
//     )
//   );
// }

// import * as vscode from "vscode";
// import { functionRange } from "./util";
// import { getFunctionSelector, keccak256 } from "viem";
// /** Code that is used to associate diagnostic entries with code actions. */
// export const EMOJI_MENTION = "emoji_mention";

// /** String to detect in the text document. */
// export const EMOJI = "function";

// export const EMOJI_COMMAND = "code-actions-sample.command";
// export const getSignatureCommand = () =>
//   vscode.commands.registerCommand("client.funcSig", async (...args) => {
//     const result: string = await vscode.commands.executeCommand(
//       EMOJI_COMMAND,
//       ...args
//     );

//     return vscode.window.showInformationMessage(result);
//   });

// export class Emojizer implements vscode.CodeActionProvider {
//   public static readonly providedCodeActionKinds = [
//     vscode.CodeActionKind.QuickFix,
//   ];

//   resolveCodeAction(
//     codeAction: vscode.CodeAction,
//     token: vscode.CancellationToken
//   ): vscode.ProviderResult<vscode.CodeAction> {
//     console.debug(codeAction);
//     if (codeAction.command.command === EMOJI_COMMAND) {
//       vscode.commands
//         .executeCommand(
//           codeAction.command.command,
//           codeAction.command.arguments
//         )
//         .then((hash: string) => {
//           vscode.window.showInformationMessage(hash);
//           return null;
//         });
//     }
//     return null;
//   }

//   public provideCodeActions(
//     document: vscode.TextDocument,
//     range: vscode.Range
//   ): vscode.CodeAction[] | undefined {
//     if (!this.isAtStartOfSmiley(document, range)) {
//       return;
//     }

//     const replaceWithSmileyCatFix = this.createFix(document, range, "😺");

//     const replaceWithSmileyFix = this.createFix(document, range, "😀");
//     // Marking a single fix as `preferred` means that users can apply it with a
//     // single keyboard shortcut using the `Auto Fix` command.
//     replaceWithSmileyFix.isPreferred = true;

//     const replaceWithSmileyHankyFix = this.createFix(document, range, "💩");

//     const commandAction = this.getFuncSig(document, range);

//     return [
//       replaceWithSmileyCatFix,
//       replaceWithSmileyFix,
//       replaceWithSmileyHankyFix,
//       commandAction,
//     ];
//   }

//   private isAtStartOfSmiley(
//     document: vscode.TextDocument,
//     range: vscode.Range
//   ) {
//     const start = range.start;
//     const line = document.lineAt(start.line);

//     const [startIndex, endIndex] = functionRange(line);
//     return (
//       line.text.indexOf("function") !== -1 &&
//       start.character >= startIndex &&
//       start.character <= endIndex
//     );
//   }

//   private createFix(
//     document: vscode.TextDocument,
//     range: vscode.Range,
//     emoji: string
//   ): vscode.CodeAction {
//     const fix = new vscode.CodeAction(
//       `Convert to ${emoji}`,
//       vscode.CodeActionKind.QuickFix
//     );
//     fix.edit = new vscode.WorkspaceEdit();
//     fix.edit.replace(
//       document.uri,
//       new vscode.Range(range.start, range.start.translate(0, 2)),
//       emoji
//     );
//     return fix;
//   }

//   private getFuncSig(
//     document: vscode.TextDocument,
//     range: vscode.Range
//   ): vscode.CodeAction {
//     const action = new vscode.CodeAction(
//       "Sighash",
//       vscode.CodeActionKind.Empty
//     );
//     action.command = {
//       command: EMOJI_COMMAND,
//       title: "Learn more about emojis",
//       tooltip: "This will open the unicode emoji page.",
//       arguments: [document, range],
//     };
//     // vscode.commands.executeCommand(EMOJI_COMMAND, [document, range]);
//     return action;
//   }
// }

// /**
//  * Provides code actions corresponding to diagnostic problems.
//  */
// export class Emojinfo implements vscode.CodeActionProvider {
//   public static readonly providedCodeActionKinds = [
//     vscode.CodeActionKind.QuickFix,
//   ];

//   provideCodeActions(
//     document: vscode.TextDocument,
//     range: vscode.Range | vscode.Selection,
//     context: vscode.CodeActionContext,
//     token: vscode.CancellationToken
//   ): vscode.CodeAction[] {
//     // for each diagnostic entry that has the matching `code`, create a code action command
//     return context.diagnostics
//       .filter((diagnostic) => diagnostic.code === EMOJI_MENTION)
//       .map((diagnostic) => this.createCommandCodeAction(diagnostic));
//   }

//   private createCommandCodeAction(
//     diagnostic: vscode.Diagnostic
//   ): vscode.CodeAction {
//     const action = new vscode.CodeAction(
//       "Learn more...",
//       vscode.CodeActionKind.QuickFix
//     );
//     action.command = {
//       command: EMOJI_COMMAND,
//       title: "Learn more about emojis",
//       tooltip: "This will open the unicode emoji page.",
//     };
//     action.diagnostics = [diagnostic];
//     action.isPreferred = true;
//     return action;
//   }
// }
