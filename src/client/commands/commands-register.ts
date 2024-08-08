import { CodeActionsProvider } from "@client/actions/client-code-actions"
import type { ClientState } from "@client/client-state"

import diagnosticsCommands from "@client/commands/diagnostics"
import forgeTestCommands from "@client/commands/forge-test"
import miscCommands from "@client/commands/misc"
import { selectorCommands } from "@client/commands/selectors"
import { executeOnSave } from "@client/commands/subscriptions"
import transformCommands from "@client/commands/transform"
import formatDocument from "@client/formatter/formatter"
import { CodelensProvider } from "@client/lens/codelens-provider"
import { Etherscan } from "@client/utils/etherscan"
import * as vscode from "vscode"
import { CLIENT_COMMAND_LIST } from "./commands-list"

export const LensProvider = new CodelensProvider()

export const registerProviders = (state: ClientState): void => {
	state.context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider("solidity", {
			async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
				return await formatDocument(document, state.context)
			},
		}),
		vscode.languages.registerCodeActionsProvider("solidity", new CodeActionsProvider(), {
			providedCodeActionKinds: CodeActionsProvider.providedCodeActionKinds,
		}),
		vscode.languages.registerCodeLensProvider({ language: "solidity", scheme: "file" }, LensProvider),
	)
}

export function registerCommands(state: ClientState): void {
	state.context.subscriptions.push(
		...miscCommands.map((command) => vscode.commands.registerCommand(...command)),
		...diagnosticsCommands.map((command) => vscode.commands.registerCommand(...command)),
		...selectorCommands.map((command) => vscode.commands.registerCommand(...command)),
		...transformCommands.map((command) => vscode.commands.registerCommand(...command)),
		...forgeTestCommands(state).map((command) => vscode.commands.registerCommand(...command)),
		executeOnSave(),
		vscode.commands.registerCommand(
			CLIENT_COMMAND_LIST["solidity.downloadVerifiedSmartContractEtherscan"],
			async () => {
				await Etherscan.downloadContractWithPrompts()
			},
		),
	)
}
