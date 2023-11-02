import type { ClientState } from "@client/client-state"
import { commandClearDiagnostics } from "@client/commands/clear"
import { commandExecTest } from "@client/commands/exec-test"
import { commandFuncsig } from "@client/commands/funcsig"
import { commandKeccak256 } from "@client/commands/keccak256"
import { commandNatspec } from "@client/commands/natspec"
import { commandTestInfo } from "@client/commands/test-info"
import { CodelensProvider } from "@client/lens/codelens-provider"
import { executeOnSave } from "@client/subscriptions/document-save"
import * as vscode from "vscode"

export const LensProvider = new CodelensProvider()
export function registerCodeLenses(state: ClientState): void {
	state.context.subscriptions.push(
		vscode.languages.registerCodeLensProvider({ language: "solidity", scheme: "file" }, LensProvider),
		...registerCodeLensCommands(state),
		executeOnSave(),
	)
}

const registerCodeLensCommands = (state: ClientState) => [
	vscode.commands.registerCommand("solidity.lens.test.info", commandTestInfo(state)),
	vscode.commands.registerCommand("solidity.lens.function.selector", commandFuncsig(state)),
	vscode.commands.registerCommand("solidity.lens.function.natspec", commandNatspec(state)),
	vscode.commands.registerCommand("solidity.lens.diagnostics.clear", commandClearDiagnostics(state)),
	vscode.commands.registerCommand("solidity.lens.function.test", commandExecTest(state)),
	vscode.commands.registerCommand("solidity.lens.string.keccak256", commandKeccak256(state)),
]
