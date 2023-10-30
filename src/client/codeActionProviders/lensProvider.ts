import * as vscode from 'vscode';
import { runForgeTest, clearTestDiagnostics } from '../formatter/forgeFormatter';
import { initDecorations, lineDecoration, resetDecorations, removeAll, runDecorated } from '../decorations';

// const functionRegexp = () => new RegExp(/(function.*?\()/g);
const functionRegexp = () => new RegExp(/function (\w+).*?\n(.+?)\}/gs);
const testFunctionRegexp = () => /function (test.*?)\(/g;
const keccak256Regexp = () => new RegExp(/(?<=keccak256\(")(.*?)(?="\))/g);

export const registerLensCommands = (context: vscode.ExtensionContext) => [
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
		clearTestDiagnostics();
		removeAll();
	}),
	vscode.commands.registerCommand(
		'solidity.lens.function.test',
		async (...args: [string, vscode.TextDocument, vscode.Range]) => {
			const functionName = args[0];
			const line = args[2].start.line;

			vscode.window.showInformationMessage(`Executing ${functionName}()`);
			initDecorations(functionName, context);
			const results = await runDecorated(
				runForgeTest(args, vscode.workspace.rootPath),
				functionName,
				line,
				'Executing..'
			);

			resetDecorations(functionName, ['success', 'fail']);

			if (results.isError && results.info) {
				vscode.window.showErrorMessage(results.info);
				if (results.info.includes('restart')) {
					lineDecoration(functionName, 'Executing..', line, 'pending');
				}
				return;
			}

			vscode.window.showInformationMessage(results.info);
			lineDecoration(functionName, results.result, line, results.isFail ? 'fail' : 'success');
		}
	),
	vscode.commands.registerCommand('solidity.lens.string.keccak256', async (...args) => {
		const result: string = await vscode.commands.executeCommand('solidity.server.lens.string.keccak256', ...args);

		return vscode.window.showInformationMessage(result);
	}),
];

/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {
	private codeLenses: vscode.CodeLens[] = [];
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

	constructor() {
		vscode.workspace.onDidChangeConfiguration((_) => {
			this._onDidChangeCodeLenses.fire();
		});
	}
	public getCodeLensFromPosition(position: vscode.Position) {
		return this.codeLenses.find((codeLens) => {
			if (codeLens.range.contains(position)) {
				return true;
			}
			return false;
		});
	}
	public provideCodeLenses(
		document: vscode.TextDocument,
		token: vscode.CancellationToken
	): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
		if (vscode.workspace.getConfiguration('solidity').get('enableCodeLens', true)) {
			this.codeLenses = [];
			const regex = functionRegexp();
			const text = document.getText();
			let matches: RegExpExecArray | null;

			// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
			while ((matches = regex.exec(text)) !== null) {
				// const line = document.lineAt(document.positionAt(matches.index).line);
				// const position = new vscode.Position(line.lineNumber, indexOf);
				// const range = document.getWordRangeAtPosition(position, functionRegexp());
				// const functionTopRange = new vscode.Range(
				// 	new vscode.Position(line.lineNumber, 0),
				// 	new vscode.Position(line.lineNumber, line.text.length)
				// );
				const posStart = document.positionAt(matches.index);
				const posEnd = document.positionAt(matches.index + matches[0].length);
				const range = new vscode.Range(posStart, posEnd);

				const line = document.lineAt(posStart.line);
				if (range) {
					const isTestFile = document.fileName.includes('.t.sol');
					if (isTestFile) {
						const testFunc = testFunctionRegexp().exec(line.text);
						if (testFunc != null && testFunc.length > 1) {
							const functionName = testFunc[1];
							this.codeLenses.push(
								new vscode.CodeLens(range, {
									title: 'execute',
									tooltip: 'Run this test function with forge',
									command: 'solidity.lens.function.test',
									arguments: [functionName, document, range],
								}),
								new vscode.CodeLens(range, {
									title: 'natspec',
									tooltip: 'Generate natspec comment',
									command: 'solidity.lens.function.natspec',
									arguments: [document, range],
								})
							);
						}
					} else {
						this.codeLenses.push(
							new vscode.CodeLens(range, {
								title: 'selector',
								tooltip: 'Preview the bytes4 selector',
								command: 'solidity.lens.function.selector',
								arguments: [document, range],
							}),
							new vscode.CodeLens(range, {
								title: 'natspec',
								tooltip: 'Generate natspec comment',
								command: 'solidity.lens.function.natspec',
								arguments: [document, range],
							})
						);
					}
				}
			}

			return this.codeLenses;
		}
		return [];
	}

	public async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
		if (vscode.workspace.getConfiguration('solidity').get('enableCodeLens', true)) {
			return codeLens;
		}
		return null;
	}
}
