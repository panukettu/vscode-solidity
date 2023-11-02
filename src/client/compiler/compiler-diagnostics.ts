import type { SolcError } from "@shared/compiler/types-solc"
import * as vscode from "vscode"
import { errorToDiagnostic } from "../../server/providers/utils/diagnostics"
import type { ErrorWarningCounts } from "../../shared/types"

export function errorsToDiagnostics(
	diagnosticCollection: vscode.DiagnosticCollection,
	errors: SolcError[],
): ErrorWarningCounts {
	const errorWarningCounts: ErrorWarningCounts = { errors: 0, warnings: 0 }
	const diagnosticMap: Map<vscode.Uri, vscode.Diagnostic[]> = new Map()

	for (const error of errors) {
		const { diagnostic, fileName, extraDiagnostics } = errorToDiagnostic(error)

		const targetUri = vscode.Uri.file(fileName)
		let diagnostics = diagnosticMap.get(targetUri)

		if (!diagnostics) {
			diagnostics = []
		}

		diagnostics.push(diagnostic as unknown as vscode.Diagnostic)
		diagnosticMap.set(targetUri, diagnostics)

		if (extraDiagnostics) {
			for (const extra of extraDiagnostics) {
				const extraURI = vscode.Uri.file(extra.fileName)
				if (extraURI.toString() === targetUri.toString()) {
					diagnostics.push(extra.diagnostic as unknown as vscode.Diagnostic)
					diagnosticMap.set(targetUri, diagnostics)
				} else {
					const extraTargetUri = vscode.Uri.file(extra.fileName)
					const extraDiagnostics = diagnosticMap.get(extraTargetUri) ?? []
					diagnosticMap.set(extraTargetUri, [...extraDiagnostics, extra.diagnostic as unknown as vscode.Diagnostic])
				}
			}
		}
	}

	const entries: [vscode.Uri, vscode.Diagnostic[]][] = []

	for (const [uri, diags] of diagnosticMap.entries()) {
		errorWarningCounts.errors += diags.filter(
			(diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error,
		).length
		errorWarningCounts.warnings += diags.filter(
			(diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Warning,
		).length

		entries.push([uri, diags])
	}

	diagnosticCollection.set(entries)

	return errorWarningCounts
}
