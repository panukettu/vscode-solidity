import * as vscode from "vscode"

import type { ClientState } from "@client/client-state"
import formatDocument from "@client/formatter/formatter"

export function registerDocumentProviders(state: ClientState) {
	state.context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider("solidity", {
			async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
				return await formatDocument(document, state.context)
			},
		}),
	)
	vscode.languages.onDidChangeDiagnostics((e) => {
		// for (const uri of e.uris) {
		// 	console.debug("removing", uri.fsPath)
		// 	state.diagnostics.default.set(uri, [])
		// }
	})
}
