import * as vscode from 'vscode';

const functionRegexp = () => new RegExp(/(function.*?\()/g);
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
			// return vscode.TextEdit.insert(args[1].start, result);
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

	public provideCodeLenses(
		document: vscode.TextDocument,
		token: vscode.CancellationToken
	): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
		if (vscode.workspace.getConfiguration('solidity').get('enableCodeLens', true)) {
			this.codeLenses = [];
			const regex = functionRegexp();
			const text = document.getText();
			let matches;
			while ((matches = regex.exec(text)) !== null) {
				const line = document.lineAt(document.positionAt(matches.index).line);
				const indexOf = line.text.indexOf(matches[0]);
				const position = new vscode.Position(line.lineNumber, indexOf);
				const range = document.getWordRangeAtPosition(position, functionRegexp());
				if (range) {
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
