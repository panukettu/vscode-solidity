import type { ClientState } from '@client/client-state';
import { TestExec } from '@client/types';
import { ErrorWarningCounts, ScopedURI } from '@shared/types';
import { toScopedURI } from '@shared/util';
import * as vscode from 'vscode';
import { Lens } from '../../code-lens-types';
import { parseOutputCompilerErrors, parseOutputLabels, parsedLabelsToDiagnostics } from './foundry-diagnostic-parsers';

export const foundryDiagnostics = new Map<ScopedURI, vscode.Diagnostic[]>();

export function saveFoundryDiagnostics(
	state: ClientState,
	scope: string,
	uri: vscode.Uri,
	diagnostics: vscode.Diagnostic[]
) {
	foundryDiagnostics.set(toScopedURI(scope, uri), diagnostics);
	state.diagnostics.foundry.set(uri, Array.from(foundryDiagnostics.values()).flat());
}

export function clearAllFoundryDiagnosticScopes(state: ClientState) {
	state.diagnostics.foundry.clear();
	foundryDiagnostics.clear();
}

export function clearFoundryDiagnosticScope(state: ClientState, scope: string, uri: vscode.Uri) {
	const scopedURI = toScopedURI(scope, uri);
	if (!foundryDiagnostics.has(scopedURI)) return;

	const diagnosticsToClear = foundryDiagnostics.get(scopedURI);
	if (!diagnosticsToClear.length) return;

	const allUriDiagnostics = state.diagnostics.foundry.get(uri) ?? [];

	state.diagnostics.foundry.set(
		uri,
		allUriDiagnostics.filter((diag) => !diagnosticsToClear.includes(diag))
	);
	foundryDiagnostics.delete(scopedURI);
}

export const handleTestCompilerErrorDiagnostic = (
	state: ClientState,
	args: Lens.ForgeTestExec,
	result: TestExec.Result,
	output: string
) => {
	const parsedErrors = parseOutputCompilerErrors(state, args, result, output);
	createCompilerErrorDiagnostics(state, args[0], parsedErrors);
};

export function createCompilerErrorDiagnostics(state: ClientState, scope: string, errors: any[]): ErrorWarningCounts {
	const errorWarningCounts = { errors: 0, warnings: 0 };
	clearAllFoundryDiagnosticScopes(state);
	state.diagnostics.clear();

	// Handle forge errors
	for (const err of errors) {
		const uri = vscode.Uri.file(err.fileName);

		if (err.fileName.includes('.t.sol')) {
			const scopedUri = toScopedURI(scope, uri);
			const previousDiagnostics = foundryDiagnostics.get(scopedUri) ?? [];
			const diagnostics = [...previousDiagnostics, err.diagnostic];
			foundryDiagnostics.set(scopedUri, diagnostics);
		}

		const previousDiagnostics = state.diagnostics.foundry.get(uri) ?? [];
		const diagnostics = [...previousDiagnostics, err.diagnostic];
		state.diagnostics.foundry.set(uri, diagnostics);

		if (err.diagnostic.severity === vscode.DiagnosticSeverity.Error) {
			errorWarningCounts.errors++;
		}
		if (err.diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
			errorWarningCounts.warnings++;
		}
	}

	return errorWarningCounts;
}

export const handleTestDiagnostic = (state: ClientState, args: Lens.ForgeTestExec, result: TestExec.Result) => {
	const [functionName, document, range] = args;
	const offset = document.offsetAt(range.start);
	const outputLabels = parseOutputLabels(result.out.logs.allLogs);
	const diagnostics = parsedLabelsToDiagnostics(args, offset, outputLabels);
	saveFoundryDiagnostics(state, functionName, document.uri, diagnostics as any);
};
