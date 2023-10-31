import type { SolcError } from '@shared/compiler/solc-types';
import * as vscode from 'vscode';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { errorToDiagnostic } from '../../server/providers/utils/diagnostics';
import type { ErrorWarningCounts } from '../../shared/types';

export function errorsToDiagnostics(
	diagnosticCollection: vscode.DiagnosticCollection,
	errors: SolcError[]
): ErrorWarningCounts {
	const errorWarningCounts: ErrorWarningCounts = { errors: 0, warnings: 0 };
	const diagnosticMap: Map<vscode.Uri, vscode.Diagnostic[]> = new Map();

	for (const error of errors) {
		const { diagnostic, fileName } = errorToDiagnostic(error);

		const targetUri = vscode.Uri.file(fileName);
		let diagnostics = diagnosticMap.get(targetUri);

		if (!diagnostics) {
			diagnostics = [];
		}

		diagnostics.push(diagnostic);
		diagnosticMap.set(targetUri, diagnostics);
	}

	const entries: [vscode.Uri, vscode.Diagnostic[]][] = [];

	for (const [uri, diags] of diagnosticMap.entries()) {
		errorWarningCounts.errors += diags.filter((diagnostic) => diagnostic.severity === DiagnosticSeverity.Error).length;
		errorWarningCounts.warnings += diags.filter(
			(diagnostic) => diagnostic.severity === DiagnosticSeverity.Warning
		).length;

		entries.push([uri, diags]);
	}

	diagnosticCollection.set(entries);

	return errorWarningCounts;
}
