import {
	AddressChecksumCodeActionProvider,
	ChangeCompilerVersionActionProvider,
	SPDXCodeActionProvider,
} from "@client/actions/code-action-fix"
import type { ClientState } from "@client/client-state"
import { EtherscanContractDownloader } from "@shared/external/etherscan"
import * as vscode from "vscode"

export function registerCodeActions(state: ClientState): void {
	state.context.subscriptions.push(
		vscode.commands.registerCommand("solidity.downloadVerifiedSmartContractEtherscan", async () => {
			await EtherscanContractDownloader.downloadContractWithPrompts()
		}),
	)

	state.context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider("solidity", new AddressChecksumCodeActionProvider(), {
			providedCodeActionKinds: AddressChecksumCodeActionProvider.providedCodeActionKinds,
		}),
	)

	state.context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider("solidity", new SPDXCodeActionProvider(), {
			providedCodeActionKinds: SPDXCodeActionProvider.providedCodeActionKinds,
		}),
	)

	state.context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider("solidity", new ChangeCompilerVersionActionProvider(), {
			providedCodeActionKinds: ChangeCompilerVersionActionProvider.providedCodeActionKinds,
		}),
	)
}
