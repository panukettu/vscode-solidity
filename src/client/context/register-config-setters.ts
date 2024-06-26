import { ClientState } from "@client/client-state"
import { CLIENT_COMMAND_LIST } from "@client/commands/commands"
import type { SolidityConfig } from "@shared/types"
import * as vscode from "vscode"

const getValidation = () =>
	vscode.workspace.getConfiguration("solidity").get("validation") as SolidityConfig["validation"]

const getTest = () => vscode.workspace.getConfiguration("solidity").get("test") as SolidityConfig["test"]
export function registerConfigSetters(state: ClientState): void {
	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableCodeLens"], () => {
			vscode.workspace.getConfiguration("solidity").update("enableCodeLens", true, true)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableCodeLens"], () => {
			vscode.workspace.getConfiguration("solidity").update("enableCodeLens", false, true)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableExecuteOnSave"], () => {
			vscode.workspace.getConfiguration("solidity").update("test", { ...getTest(), executeOnSave: false }, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableExecuteOnSave"], () => {
			vscode.workspace.getConfiguration("solidity").update("test", { ...getTest(), executeOnSave: true }, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.test.enableTracing"], () => {
			vscode.workspace.getConfiguration("solidity").update("test", { ...getTest(), verbosity: 5 }, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.test.disableTracing"], () => {
			vscode.workspace.getConfiguration("solidity").update("test", { ...getTest(), verbosity: 2 }, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableValidateOnChange"], () => {
			vscode.workspace.getConfiguration("solidity").update("validation", { ...getValidation(), onChange: true }, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableValidateOnChange"], () => {
			vscode.workspace.getConfiguration("solidity").update("validation", { ...getValidation(), onChange: false }, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableValidateOnSave"], () => {
			vscode.workspace.getConfiguration("solidity").update("validation", { ...getValidation(), onSave: true }, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableValidateOnSave"], () => {
			vscode.workspace.getConfiguration("solidity").update("validation", { ...getValidation(), onSave: false }, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableValidateOnOpen"], () => {
			vscode.workspace.getConfiguration("solidity").update("validation", { ...getValidation(), onOpen: true }, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableValidateOnOpen"], () => {
			vscode.workspace.getConfiguration("solidity").update("validation", { ...getValidation(), onOpen: false }, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableAllValidation"], () => {
			vscode.workspace
				.getConfiguration("solidity")
				.update("validation", { onSave: false, onOpen: false, onChange: false }, false)
		}),
	)
}
