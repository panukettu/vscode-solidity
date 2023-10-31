import * as vscode from 'vscode';

// const functionRegexp = () => new RegExp(/(function.*?\()/g);
const functionRegexp = () => new RegExp(/function (\w+).*?\n(.+?)\}/gs);
const testFunctionRegexp = () => /function (test.*?)\(/g;
const keccak256Regexp = () => new RegExp(/(?<=keccak256\(")(.*?)(?="\))/g);

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
