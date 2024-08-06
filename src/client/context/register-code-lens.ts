import type { ClientState } from "@client/client-state"
import { commandClearDiagnostics } from "@client/commands/command-clear-diagnostics"
import { commandNatspec } from "@client/commands/command-create-natspec"
import { commandFuncsig } from "@client/commands/command-funcsig"
import { commandKeccak256 } from "@client/commands/command-keccak256"
import { commandExecTest } from "@client/commands/command-test-execute"
import { commandTestInfo } from "@client/commands/command-test-info"
import { CLIENT_COMMAND_LIST } from "@client/commands/commands"
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

const errorWrapper =
	(fn: (...args: any[]) => any) =>
	(...args: any[]) => {
		try {
			return fn(...args)
		} catch (e) {
			console.debug("Command", e.message)
		}
	}

const registerCodeLensCommands = (state: ClientState) => [
	vscode.commands.registerCommand(
		CLIENT_COMMAND_LIST["solidity.lens.function.test.info"],
		errorWrapper(commandTestInfo(state)),
	),
	vscode.commands.registerCommand(
		CLIENT_COMMAND_LIST["solidity.lens.function.selector"],
		errorWrapper(commandFuncsig(state)),
	),
	vscode.commands.registerCommand(
		CLIENT_COMMAND_LIST["solidity.lens.function.natspec"],
		errorWrapper(commandNatspec(state)),
	),
	vscode.commands.registerCommand(
		CLIENT_COMMAND_LIST["solidity.diagnostics.clear"],
		errorWrapper(commandClearDiagnostics(state)),
	),
	vscode.commands.registerCommand(
		CLIENT_COMMAND_LIST["solidity.lens.function.test"],
		errorWrapper(commandExecTest(state)),
	),
	vscode.commands.registerCommand(
		CLIENT_COMMAND_LIST["solidity.lens.string.keccak256"],
		errorWrapper(commandKeccak256(state)),
	),
]
