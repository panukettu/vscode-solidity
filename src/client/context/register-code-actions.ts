import { CodeActionsProvider } from "@client/actions/client-code-actions"
import type { ClientState } from "@client/client-state"
import { Etherscan } from "@shared/external/etherscan"
import * as vscode from "vscode"

export function registerCodeActions(state: ClientState): void {
	state.context.subscriptions.push(
		vscode.commands.registerCommand("solidity.downloadVerifiedSmartContractEtherscan", async () => {
			await Etherscan.downloadContractWithPrompts()
		}),
		vscode.languages.registerCodeActionsProvider("solidity", new CodeActionsProvider(), {
			providedCodeActionKinds: CodeActionsProvider.providedCodeActionKinds,
		}),
	)
}
