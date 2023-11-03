import { ClientState } from "@client/client-state"
import { CLIENT_COMMAND_LIST } from "@client/commands/list"
import * as vscode from "vscode"

export function registerConfigSetters(state: ClientState): void {
	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableCodeLens"], () => {
			vscode.workspace.getConfiguration("solidity").update("enableCodeLens", true, true)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableCodeLens"], () => {
			vscode.workspace.getConfiguration("solidity").update("enableCodeLens", false, true)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.test.disableExecuteOnSave"], () => {
			vscode.workspace.getConfiguration("solidity").update("test.executeOnSave", false, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.test.enableExecuteOnsave"], () => {
			vscode.workspace.getConfiguration("solidity").update("test.executeOnSave", true, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.test.enableTracing"], () => {
			vscode.workspace.getConfiguration("solidity").update("test.verbosity", 4, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.test.disableTracing"], () => {
			vscode.workspace.getConfiguration("solidity").update("test.verbosity", 2, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableValidateOnChange"], () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnChange", true, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableValidateOnChange"], () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnChange", false, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableValidateOnSave"], () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnSave", true, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableValidateOnSave"], () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnSave", false, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableValidateOnOpen"], () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnOpen", true, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableValidateOnOpen"], () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnOpen", false, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableAllValidation"], () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnOpen", false, false)
			vscode.workspace.getConfiguration("solidity").update("validateOnSave", false, false)
			vscode.workspace.getConfiguration("solidity").update("validateOnChange", false, false)
		}),
	)
}
