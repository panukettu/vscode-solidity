import type { ClientState } from '@client/client-state';
import { CompilerError, ErrorWarningCounts } from '@shared/types';
import * as vscode from 'vscode';

export const testDiagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();

export function clearTestDiagnostics(state: ClientState) {
	state.diagnosticsTest.clear();
	testDiagnosticsMap.clear();
}

export function clearTestDiagnosticScope(state: ClientState, scope: string, uri: vscode.Uri) {
	testDiagnosticsMap.set(scope, []);
	state.diagnosticsTest.set(uri, Array.from(testDiagnosticsMap.values()).flat());
}

export function forgeErrorsToDiagnostics(state: ClientState, errors: CompilerError[]): ErrorWarningCounts {
	const errorWarningCounts: ErrorWarningCounts = { errors: 0, warnings: 0 };
	const diagnosticMap: Map<vscode.Uri, vscode.Diagnostic[]> = new Map();

	for (const err of errors) {
		const targetUri = vscode.Uri.file(err.fileName);
		const diagnostics = diagnosticMap.get(targetUri) ?? [];

		diagnostics.push(err.diagnostic);
		diagnosticMap.set(targetUri, diagnostics);
	}

	const entries: [vscode.Uri, vscode.Diagnostic[]][] = [];
	for (const [key, diagnostic] of diagnosticMap.entries()) {
		errorWarningCounts.errors += diagnostic.filter(
			(diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error
		).length;
		errorWarningCounts.warnings += diagnostic.filter(
			(diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Warning
		).length;

		entries.push([key, diagnostic]);
	}
	diagnosticMap.forEach((diags, uri) => {
		entries.push([uri, diags]);
	});
	state.diagnosticsTest.set(entries);

	return errorWarningCounts;
}

export function parseForgeErrorsFromStdOut(match: string[], rootPath: string): CompilerError {
	const [, code, message, fileName, line, character] = match;
	const position = { line: parseInt(line) - 1, character: parseInt(character) };
	const result = {
		diagnostic: {
			message: message.trim(),
			code: code.trim(),
			range: {
				start: position,
				end: position,
			},
			severity: 1,
		},
		fileName: `${rootPath}/${fileName}`,
	};
	return result;
}
