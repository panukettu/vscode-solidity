import * as vscode from 'vscode';
import { CodelensProvider, registerLensCommands } from '../codeActionProviders/lensProvider';
import { runForgeTest } from '../formatter/forgeFormatter';

export function extraSubscriptions(context: vscode.ExtensionContext): void {
	const codeLens = new CodelensProvider();
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider({ language: 'solidity', scheme: 'file' }, codeLens)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.enableCodeLens', () => {
			vscode.workspace.getConfiguration('solidity').update('enableCodeLens', true, true);
		}),
		vscode.commands.registerCommand('solidity.disableCodeLens', () => {
			vscode.workspace.getConfiguration('solidity').update('enableCodeLens', false, true);
		}),
		vscode.commands.registerCommand('solidity.disableExecuteTestFunctionOnSave', () => {
			vscode.workspace.getConfiguration('solidity').update('executeTestFunctionOnSave', false, false);
		}),
		vscode.commands.registerCommand('solidity.enableExecuteTestFunctionOnSave', () => {
			vscode.workspace.getConfiguration('solidity').update('executeTestFunctionOnSave', true, false);
		}),
		vscode.commands.registerCommand('solidity.enableValidateOnChange', () => {
			vscode.workspace.getConfiguration('solidity').update('validateOnChange', true, false);
		}),
		vscode.commands.registerCommand('solidity.disableValidateOnChange', () => {
			vscode.workspace.getConfiguration('solidity').update('validateOnChange', false, false);
		}),
		vscode.commands.registerCommand('solidity.enableValidateOnSave', () => {
			vscode.workspace.getConfiguration('solidity').update('validateOnSave', true, false);
		}),
		vscode.commands.registerCommand('solidity.disableValidateOnSave', () => {
			vscode.workspace.getConfiguration('solidity').update('validateOnSave', false, false);
		}),
		vscode.commands.registerCommand('solidity.enableValidateOnOpen', () => {
			vscode.workspace.getConfiguration('solidity').update('validateOnOpen', true, false);
		}),
		vscode.commands.registerCommand('solidity.disableValidateOnOpen', () => {
			vscode.workspace.getConfiguration('solidity').update('validateOnOpen', false, false);
		}),
		vscode.commands.registerCommand('solidity.disableAllValidation', () => {
			vscode.workspace.getConfiguration('solidity').update('validateOnOpen', false, false);
			vscode.workspace.getConfiguration('solidity').update('validateOnSave', false, false);
			vscode.workspace.getConfiguration('solidity').update('validateOnChange', false, false);
		}),

		...registerLensCommands(context)
	);

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(async (e) => {
			if (e.languageId === 'solidity' && e.fileName.endsWith('.t.sol')) {
				const isEnabled = vscode.workspace.getConfiguration('solidity').get('executeTestFunctionOnSave', true);
				if (!isEnabled) return;

				const position = vscode.window.activeTextEditor?.selection.active;
				if (!position) return;

				const lens = codeLens.getCodeLensFromPosition(position);
				if (!lens || !lens.command?.arguments?.length) return;

				vscode.commands.executeCommand(lens.command.command, ...lens.command.arguments);
			}
		})
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
