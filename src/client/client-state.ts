import * as vscode from "vscode"
import { LanguageClient } from "vscode-languageclient/node"
import type { DecorationScope } from "./client-types"
import { ClientCompilers } from "./compiler/compiler-client"
export type ClientState = {
	context: vscode.ExtensionContext
	client: LanguageClient | undefined
	diagnostics: {
		default: vscode.DiagnosticCollection
		// foundry: vscode.DiagnosticCollection
		clear(): void
	}
	compilers: ClientCompilers
	decorations: Map<string, DecorationScope>
}

let clientState: ClientState

export function setupClientState(context: vscode.ExtensionContext) {
	const compilers = new ClientCompilers(context.extensionPath)
	compilers.initializeSolcs()
	clientState = {
		context,
		compilers,
		client: undefined,
		diagnostics: {
			default: vscode.languages.createDiagnosticCollection("solidity"),
			// foundry: vscode.languages.createDiagnosticCollection("solidity"),
			clear: () => {
				clientState.diagnostics.default.clear()
				// clientState.diagnostics.foundry.clear()
			},
		},
		decorations: new Map<string, DecorationScope>(),
	}

	context.subscriptions.push(clientState.diagnostics.default)
	// context.subscriptions.push(clientState.diagnostics.foundry)
	return clientState
}
