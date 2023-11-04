import { CodeActionsProvider } from "@client/actions/client-code-actions"
import type { ClientState } from "@client/client-state"
import { EtherscanContractDownloader } from "@shared/external/etherscan"
import * as vscode from "vscode"

export function registerCodeActions(state: ClientState): void {
	state.context.subscriptions.push()

	state.context.subscriptions.push(
		vscode.commands.registerCommand("solidity.downloadVerifiedSmartContractEtherscan", async () => {
			await EtherscanContractDownloader.downloadContractWithPrompts()
		}),
		vscode.languages.registerCodeActionsProvider("solidity", new CodeActionsProvider(), {
			providedCodeActionKinds: CodeActionsProvider.providedCodeActionKinds,
		}),
	)
}
