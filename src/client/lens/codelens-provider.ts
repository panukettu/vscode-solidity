import { CLIENT_COMMAND_LIST } from "@client/commands/commands-list"
import { errorRegexp, functionRegexp, testFunctionRegexp } from "@shared/regexp"
import * as vscode from "vscode"

// function extractFunctionBody(startLine: number, codes: string[]) {
// 	const functionBody = []
// 	let depth = 0
// 	let bodyLine = ""
// 	let isOpened = false

// 	const lines = codes.slice(startLine)
// 	let currentLine = startLine

// 	for (const line of lines) {
// 		const openBraces = (line.match(/{/g) || []).length
// 		const closeBraces = (line.match(/}/g) || []).length
// 		const isOpener = !isOpened && openBraces > 0
// 		currentLine++

// 		if (isOpener) {
// 			isOpened = true
// 			depth = 1
// 			continue
// 		}
// 		if (openBraces > 0) {
// 			bodyLine = line
// 			depth += openBraces
// 		} else if (depth > 0) {
// 			bodyLine += `\n${line}`
// 			depth += openBraces - closeBraces
// 			if (depth === 0) {
// 				functionBody.push(bodyLine)
// 				bodyLine = ""
// 				return functionBody
// 			}
// 		}
// 	}

// 	return functionBody
// }

/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {
	private codeLenses: vscode.CodeLens[] = []
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event

	constructor() {
		vscode.workspace.onDidChangeConfiguration((_) => {
			this._onDidChangeCodeLenses.fire()
		})
	}
	getCodeLensFromPosition(command: string, position: vscode.Position) {
		return this.codeLenses.find((codeLens) => {
			if (codeLens.command.command === command && codeLens.range.contains(position)) {
				return true
			}
			return false
		})
	}
	async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
		this.codeLenses = []
		if (!vscode.workspace.getConfiguration("solidity").get("enableCodeLens", true)) return []
		const regex = functionRegexp()
		const errorRegex = errorRegexp()
		const text = document.getText()
		let matches: RegExpExecArray | null
		let errorMatches: RegExpExecArray | null
		while ((errorMatches = errorRegex.exec(text)) !== null) {
			const posStart = document.positionAt(errorMatches.index)
			const posEnd = document.positionAt(errorMatches.index + errorMatches[0].length)
			const range = new vscode.Range(posStart, posEnd)
			const line = document.lineAt(posStart.line)
			if (range) {
				this.codeLenses.push(
					new vscode.CodeLens(range, {
						title: "selector",
						tooltip: "Preview the bytes4 selector",
						command: CLIENT_COMMAND_LIST["solidity.lens.function.selector"],
						arguments: [document, range, line],
					}),
					new vscode.CodeLens(range, {
						title: "selectors",
						tooltip: "Preview error selector in this file",
						command: CLIENT_COMMAND_LIST["solidity.lens.error.selectors"],
						arguments: [document, range, line],
					}),
				)
			}
		}
		while ((matches = regex.exec(text)) !== null) {
			// console.log("body", matches.groups?.body)
			const posStart = document.positionAt(matches.index)
			const posEnd = document.positionAt(matches.index + matches[0].length)
			const line = document.lineAt(posStart.line)

			const lineText = line.text
			const hasOpeningBrace = lineText.includes("{")

			// get the fucking function body to provide correct values from "getCodeLensFromPosition"
			const functionBody = []
			let depth = hasOpeningBrace ? 1 : 0
			if (hasOpeningBrace) {
				functionBody.push("{")
			}

			let lineNumber = posStart.line
			while (depth > 0) {
				lineNumber++
				const text = document.lineAt(lineNumber).text
				const openBraces = (text.match(/{/g) || []).length
				const closeBraces = (text.match(/}/g) || []).length
				depth += openBraces - closeBraces
				functionBody.push(text)
			}
			const endLine = document.lineAt(lineNumber)
			const range = new vscode.Range(posStart, endLine.range.end)

			if (range) {
				const isTestFile = document.fileName.includes(".t.sol")
				if (isTestFile) {
					const testFunc = testFunctionRegexp().exec(line.text)
					if (testFunc != null && testFunc.length > 1) {
						const functionName = testFunc[1]
						this.codeLenses.push(
							new vscode.CodeLens(range, {
								title: "execute",
								tooltip: "Run this test function with forge",
								command: CLIENT_COMMAND_LIST["solidity.lens.function.test"],
								arguments: [functionName, document, range],
							}),
							new vscode.CodeLens(range, {
								title: "print",
								tooltip: "Print contracts to the output channel",
								command: CLIENT_COMMAND_LIST["solidity.lens.function.test.info"],
								arguments: [functionName, document, range],
							}),
							new vscode.CodeLens(range, {
								title: "natspec",
								tooltip: "Generate natspec comment",
								command: CLIENT_COMMAND_LIST["solidity.lens.function.natspec"],
								arguments: [document, range],
							}),
						)
					}
				} else {
					this.codeLenses.push(
						new vscode.CodeLens(range, {
							title: "selector",
							tooltip: "Preview the bytes4 selector",
							command: CLIENT_COMMAND_LIST["solidity.lens.function.selector"],
							arguments: [document, range],
						}),
						new vscode.CodeLens(range, {
							title: "selectors",
							tooltip: "Preview all function selectors in this file",
							command: CLIENT_COMMAND_LIST["solidity.lens.function.selectors"],
							arguments: [document, range, line],
						}),
						new vscode.CodeLens(range, {
							title: "natspec",
							tooltip: "Generate natspec comment",
							command: CLIENT_COMMAND_LIST["solidity.lens.function.natspec"],
							arguments: [document, range],
						}),
					)
				}
			}
		}

		return this.codeLenses
	}

	async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
		if (vscode.workspace.getConfiguration("solidity").get("enableCodeLens", true)) {
			return codeLens
		}
		return null
	}
}
