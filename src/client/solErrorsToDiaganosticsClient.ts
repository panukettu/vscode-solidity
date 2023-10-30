'use strict';
import * as vscode from 'vscode';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { errorToDiagnostic } from '../server/providers/utils/diagnostics';
import { CompilerError } from '../server/types';

interface ErrorWarningCounts {
	errors: number;
	warnings: number;
}

export function errorsToDiagnostics(
	diagnosticCollection: vscode.DiagnosticCollection,
	errors: any
): ErrorWarningCounts {
	const errorWarningCounts: ErrorWarningCounts = { errors: 0, warnings: 0 };
	const diagnosticMap: Map<vscode.Uri, vscode.Diagnostic[]> = new Map();

	errors.forEach((error) => {
		const { diagnostic, fileName } = errorToDiagnostic(error);

		const targetUri = vscode.Uri.file(fileName);
		let diagnostics = diagnosticMap.get(targetUri);

		if (!diagnostics) {
			diagnostics = [];
		}

		diagnostics.push(diagnostic);
		diagnosticMap.set(targetUri, diagnostics);
	});

	const entries: [vscode.Uri, vscode.Diagnostic[]][] = [];

	diagnosticMap.forEach((diags, uri) => {
		errorWarningCounts.errors += diags.filter((diagnostic) => diagnostic.severity === DiagnosticSeverity.Error).length;
		errorWarningCounts.warnings += diags.filter(
			(diagnostic) => diagnostic.severity === DiagnosticSeverity.Warning
		).length;

		entries.push([uri, diags]);
	});

	diagnosticCollection.set(entries);

	return errorWarningCounts;
}

export function forgeErrorsToDiagnostics(
	diagnosticCollection: vscode.DiagnosticCollection,
	errors: CompilerError[]
): ErrorWarningCounts {
	const errorWarningCounts: ErrorWarningCounts = { errors: 0, warnings: 0 };
	const diagnosticMap: Map<vscode.Uri, vscode.Diagnostic[]> = new Map();

	for (const err of errors) {
		const targetUri = vscode.Uri.file(err.fileName);
		const diagnostics = diagnosticMap.get(targetUri) ?? [];

		diagnostics.push(err.diagnostic);
		diagnosticMap.set(targetUri, diagnostics);
	}

	const entries: [vscode.Uri, vscode.Diagnostic[]][] = [];

	diagnosticMap.forEach((diags, uri) => {
		errorWarningCounts.errors += diags.filter((diagnostic) => diagnostic.severity === DiagnosticSeverity.Error).length;
		errorWarningCounts.warnings += diags.filter(
			(diagnostic) => diagnostic.severity === DiagnosticSeverity.Warning
		).length;

		entries.push([uri, diags]);
	});
	diagnosticCollection.set(entries);

	return errorWarningCounts;
}
