import type { ClientState } from "@client/client-state"
import type { Lens, TestExec } from "@client/client-types"
import type { ScopedURI } from "@shared/types"
import { toScopedURI } from "@shared/util"
import * as vscode from "vscode"

import { clearDiagnostics, sendDiagnostics } from "@client/commands/diagnostics"
import { createDiagnosticFromLabels, parseOutputCompilerErrors, parseOutputLabels } from "./foundry-diagnostic-parsers"

export const foundryDiagnostics = new Map<ScopedURI, vscode.Diagnostic[]>()

export function sendLabelDiagnostics(
	state: ClientState,
	scope: string,
	uri: vscode.Uri,
	diagnostics: vscode.Diagnostic[],
) {
	foundryDiagnostics.set(toScopedURI(scope, uri), diagnostics)
	state.diagnostics.default.set(uri, Array.from(foundryDiagnostics.values()).flat())
}

export function clearAllFoundryDiagnosticScopes() {
	foundryDiagnostics.clear()
}

export const createCompilerDiagnostics = async (output: string) => {
	const parsedErrors: any[] = parseOutputCompilerErrors(output)
	const errorWarningCounts = { errors: 0, warnings: 0 }
	const diagnosticsMap = new Map<string, vscode.Diagnostic[]>()

	await clearDiagnostics()

	for (const err of parsedErrors) {
		const uri = vscode.Uri.file(err.fileName)

		const previousDiagnostics = diagnosticsMap.get(uri.toString()) ?? []
		diagnosticsMap.set(uri.toString(), [...previousDiagnostics, err.diagnostic])

		if (err.diagnostic.severity === vscode.DiagnosticSeverity.Error) {
			errorWarningCounts.errors++
		}
		if (err.diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
			errorWarningCounts.warnings++
		}
	}

	sendDiagnostics({ diagnostics: Array.from(diagnosticsMap.entries()), openProblems: true })
	return errorWarningCounts
}

export const createTestDiagnostics = (state: ClientState, args: Lens.ForgeTestExec, result: TestExec.Result) => {
	const [functionName, document, range] = args
	const outputLabels = parseOutputLabels(result.out.logs.all)
	const diagnostics = createDiagnosticFromLabels(args, document.offsetAt(range.start), outputLabels)
	sendLabelDiagnostics(state, functionName, document.uri, diagnostics as any)
}

// const functionName = args[0]
// Handle forge errors
// if (err.fileName.includes(".t.sol")) {
// 	const scopedUri = toScopedURI(functionName, uri)

// 	const previousDiagnostics = foundryDiagnostics.get(scopedUri) ?? []
// 	const diagnostics = [...previousDiagnostics, err.diagnostic]
// 	foundryDiagnostics.set(scopedUri, diagnostics)
// }
