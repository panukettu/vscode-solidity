import type { ClientRequests, Result } from "@shared/types-request"
import * as vscode from "vscode"
import type { LanguageClient } from "vscode-languageclient/node"
import type { URI } from "vscode-uri"
import type { DecorationScope } from "./client-types"
import { ClientCompilers } from "./compiler/compiler-client"
export type ClientState = {
	context: vscode.ExtensionContext
	lsp: LanguageClient | undefined
	diagnostics: {
		default: vscode.DiagnosticCollection
		// foundry: vscode.DiagnosticCollection
		clear: (document?: URI) => void
	}
	send: <T extends ClientRequests>(message: T) => Result<T["type"]>
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
		lsp: undefined,
		diagnostics: {
			default: vscode.languages.createDiagnosticCollection("solidity"),
			clear: (uri) => {
				if (!uri) return clientState.diagnostics.default.clear()
				clientState.diagnostics.default.delete(uri)
			},
		},
		send: (message) => {
			if (!clientState.lsp) throw new Error("Language client not initialized")

			return clientState.lsp.sendRequest("request", message) as any
		},
		decorations: new Map<string, DecorationScope>(),
	}

	context.subscriptions.push(clientState.diagnostics.default)
	// context.subscriptions.push(clientState.diagnostics.foundry)
	return clientState
}

export function getClientState() {
	return clientState
}
