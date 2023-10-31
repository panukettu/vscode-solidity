import { ClientState } from '@client/client-state';
import { clearTestDiagnostics } from '@client/code-lens/diagnostics';
import { execForgeTestFunction } from '@client/code-lens/foundry/test';
import * as vscode from 'vscode';
import { CodelensProvider } from '../code-lens/code-lenses';
import { initDecorations, lineDecoration, removeAll, resetDecorations, runDecorated } from '../decorations';

export function registerCodeLenses(state: ClientState): void {
	const codeLens = new CodelensProvider();
	state.context.subscriptions.push(
		vscode.languages.registerCodeLensProvider({ language: 'solidity', scheme: 'file' }, codeLens)
	);

	state.context.subscriptions.push(
		...registerCodeLensCommands(state),
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
}

const registerCodeLensCommands = (state: ClientState) => [
	vscode.commands.registerCommand(
		'solidity.lens.function.selector',
		async (...args: [vscode.TextDocument, vscode.Range]) => {
			const result: string = await vscode.commands.executeCommand('solidity.server.lens.function.selector', ...args);

			return vscode.window.showInformationMessage(result);
		}
	),
	vscode.commands.registerCommand(
		'solidity.lens.function.natspec',
		async (...args: [vscode.TextDocument, vscode.Range]) => {
			const result: string = await vscode.commands.executeCommand('solidity.server.lens.function.natspec', ...args);
			return vscode.window.activeTextEditor.edit((editBuilder) => {
				const position = new vscode.Position(args[1].start.line, 0);
				editBuilder.insert(position, result);
			});
		}
	),
	vscode.commands.registerCommand('solidity.lens.diagnostics.clear', async () => {
		clearTestDiagnostics(state);
		removeAll(state);
	}),
	vscode.commands.registerCommand(
		'solidity.lens.function.test',
		async (...args: [string, vscode.TextDocument, vscode.Range]) => {
			const functionName = args[0];
			const line = args[2].start.line;

			vscode.window.showInformationMessage(`Executing ${functionName}()`);
			initDecorations(state, functionName);

			const runArgs = {
				promise: execForgeTestFunction(state, args, vscode.workspace.rootPath),
				scope: functionName,
				line,
			};

			const results = await runDecorated(state, runArgs, 'Executing..');

			resetDecorations(state, functionName, ['success', 'fail']);

			if (results.isError && results.info) {
				vscode.window.showErrorMessage(results.info);
				if (results.info.includes('restart')) {
					lineDecoration(state, {
						scope: functionName,
						text: 'Executing..',
						line,
						type: 'pending',
					});
				}
				return;
			}

			vscode.window.showInformationMessage(results.info);

			// const decorArgs = {
			// 	scope: functionName,
			// 	text: results.result,
			// 	line,
			// 	type: results.isFail ? 'fail' : 'success',
			// } as const;
			lineDecoration(state, results.resultDecor);
		}
	),
	vscode.commands.registerCommand('solidity.lens.string.keccak256', async (...args) => {
		const result: string = await vscode.commands.executeCommand('solidity.server.lens.string.keccak256', ...args);

		return vscode.window.showInformationMessage(result);
	}),
];
