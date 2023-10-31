import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { ClientCompilers } from './compiler-client';
import { DecorationScope } from './decorations';
export type ClientState = {
	context: vscode.ExtensionContext;
	client: LanguageClient | undefined;
	diagnostics: vscode.DiagnosticCollection;
	diagnosticsTest: vscode.DiagnosticCollection;
	clientCompilers: ClientCompilers;
	decorations: Map<string, DecorationScope>;
};

let clientState: ClientState | undefined = undefined;

export function setupClientState(context: vscode.ExtensionContext) {
	const clientCompilers = new ClientCompilers(context.extensionPath);
	clientCompilers.initializeSolcs();
	clientState = {
		context,
		clientCompilers,
		diagnostics: vscode.languages.createDiagnosticCollection('solidity'),
		diagnosticsTest: vscode.languages.createDiagnosticCollection('solidity-test'),
		client: undefined,
		decorations: new Map<string, DecorationScope>(),
	};

	context.subscriptions.push(clientState.diagnostics);
	context.subscriptions.push(clientState.diagnosticsTest);
	return clientState;
}
