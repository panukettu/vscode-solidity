import type { ClientState } from "@client/client-state"
import type { Lens, TestExec } from "@client/client-types"
import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import type { ErrorWarningCounts, ScopedURI } from "@shared/types"
import { toScopedURI } from "@shared/util"
import * as vscode from "vscode"
import { Diagnostic, Position, Range } from "vscode-languageclient"
import { parseOutputCompilerErrors, parseOutputLabels } from "./foundry-diagnostic-parsers"

export const foundryDiagnostics = new Map<ScopedURI, vscode.Diagnostic[]>()

export function saveFoundryDiagnostics(
	state: ClientState,
	scope: string,
	uri: vscode.Uri,
	diagnostics: vscode.Diagnostic[],
) {
	foundryDiagnostics.set(toScopedURI(scope, uri), diagnostics)
	state.diagnostics.default.set(uri, Array.from(foundryDiagnostics.values()).flat())
}

export function clearAllFoundryDiagnosticScopes(state: ClientState) {
	foundryDiagnostics.clear()
}

export const createCompilerDiagnostics = (
	state: ClientState,
	args: Lens.ForgeTestExec,
	result: TestExec.Result,
	output: string,
): ErrorWarningCounts => {
	const parsedErrors: any[] = parseOutputCompilerErrors(state, args, result, output)
	const errorWarningCounts = { errors: 0, warnings: 0 }
	const diagnosticsMap = new Map<string, vscode.Diagnostic[]>()
	state.diagnostics.clear()

	// const functionName = args[0]
	// Handle forge errors
	for (const err of parsedErrors) {
		const uri = vscode.Uri.file(err.fileName)

		// if (err.fileName.includes(".t.sol")) {
		// 	const scopedUri = toScopedURI(functionName, uri)

		// 	const previousDiagnostics = foundryDiagnostics.get(scopedUri) ?? []
		// 	const diagnostics = [...previousDiagnostics, err.diagnostic]
		// 	foundryDiagnostics.set(scopedUri, diagnostics)
		// }

		const previousDiagnostics = diagnosticsMap.get(uri.toString()) ?? []
		diagnosticsMap.set(uri.toString(), [...previousDiagnostics, err.diagnostic])

		if (err.diagnostic.severity === vscode.DiagnosticSeverity.Error) {
			errorWarningCounts.errors++
		}
		if (err.diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
			errorWarningCounts.warnings++
		}
	}

	const diagnostics = Array.from(diagnosticsMap.entries()).map(([uri, diagnostics]) => {
		return [uri, diagnostics] as [string, vscode.Diagnostic[]]
	})
	vscode.commands.executeCommand(SERVER_COMMANDS_LIST["diagnostic.set"], args[1], args[2], diagnostics)
	return errorWarningCounts
}

export const createTestDiagnostics = (state: ClientState, args: Lens.ForgeTestExec, result: TestExec.Result) => {
	const [functionName, document, range] = args
	const offset = document.offsetAt(range.start)
	const outputLabels = parseOutputLabels(result.out.logs.all)
	const diagnostics = createDiagnosticFromLabels(args, offset, outputLabels)
	saveFoundryDiagnostics(state, functionName, document.uri, diagnostics as any)
}

export const createDiagnosticFromLabels = (
	args: Lens.ForgeTestExec,
	offset: number,
	labels: ReturnType<typeof parseOutputLabels>,
) => {
	const [functionName, document, range] = args
	const docText = document.getText(range)
	const results = labels.map((item) => {
		const id = item.key
		if (id === "") return null

		const indexSingle = docText.indexOf(`'${id}`)
		const indexDouble = docText.indexOf(`"${id}`)
		const exactDouble = docText.indexOf(`"${id}"`)
		const exactSingle = docText.indexOf(`'${id}'`)
		const indexLoose = docText.indexOf(id)

		let index = Math.max(indexSingle, indexDouble)

		if (exactDouble !== -1 || exactSingle !== -1) index = Math.max(exactDouble, exactSingle)
		if (indexLoose !== -1 && index === -1) index = indexLoose
		if (index === -1) return null

		const position = document.positionAt(offset + index + 1)
		const line = document.lineAt(position.line)
		const range = Range.create(
			Position.create(
				line.lineNumber,
				item.severity === 1 ? line.firstNonWhitespaceCharacterIndex : position.character,
			),
			Position.create(
				line.lineNumber,
				item.severity === 1 ? line.range.end.character - 1 : position.character + id.length,
			),
		)

		const diagnostic = Diagnostic.create(
			range,
			`${item.value}`,
			item.severity as any,
			item.severity === 1 ? "assert" : "log",
			"forge-test",
		)
		diagnostic.source = `${functionName}: ${id}`

		return diagnostic
	})

	return results.filter(Boolean)
}
