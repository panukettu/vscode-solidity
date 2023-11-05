import { ClientState } from "@client/client-state"
import { CLIENT_COMMAND_LIST } from "@client/commands/commands"
import * as vscode from "vscode"

export function registerConfigSetters(state: ClientState): void {
	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableCodeLens"], () => {
			vscode.workspace.getConfiguration("solidity").update("enableCodeLens", true, true)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableCodeLens"], () => {
			vscode.workspace.getConfiguration("solidity").update("enableCodeLens", false, true)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableExecuteOnSave"], () => {
			vscode.workspace.getConfiguration("solidity.test").update("executeOnSave", false, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableExecuteOnSave"], () => {
			vscode.workspace.getConfiguration("solidity.test").update("executeOnSave", true, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.test.enableTracing"], () => {
			vscode.workspace.getConfiguration("solidity.test").update("verbosity", 5, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.test.disableTracing"], () => {
			vscode.workspace.getConfiguration("solidity.test").update("verbosity", 2, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableValidateOnChange"], () => {
			vscode.workspace.getConfiguration("solidity.validation").update("onChange", true, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableValidateOnChange"], () => {
			vscode.workspace.getConfiguration("solidity.validation").update("onChange", false, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableValidateOnSave"], () => {
			vscode.workspace.getConfiguration("solidity.validation").update("onSave", true, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableValidateOnSave"], () => {
			vscode.workspace.getConfiguration("solidity.validation").update("onSave", false, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.enableValidateOnOpen"], () => {
			vscode.workspace.getConfiguration("solidity.validation").update("onOpen", true, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableValidateOnOpen"], () => {
			vscode.workspace.getConfiguration("solidity.validation").update("onOpen", false, false)
		}),
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.disableAllValidation"], () => {
			vscode.workspace.getConfiguration("solidity.validation").update("onOpen", false, false)
			vscode.workspace.getConfiguration("solidity.validation").update("onSave", false, false)
			vscode.workspace.getConfiguration("solidity.validation").update("onChange", false, false)
		}),
	)
}
