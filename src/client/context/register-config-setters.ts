import { ClientState } from "@client/client-state"
import * as vscode from "vscode"

export function registerConfigSetters(state: ClientState): void {
	state.context.subscriptions.push(
		vscode.commands.registerCommand("solidity.enableCodeLens", () => {
			vscode.workspace.getConfiguration("solidity").update("enableCodeLens", true, true)
		}),
		vscode.commands.registerCommand("solidity.disableCodeLens", () => {
			vscode.workspace.getConfiguration("solidity").update("enableCodeLens", false, true)
		}),
		vscode.commands.registerCommand("solidity.test.disableExecuteOnSave", () => {
			vscode.workspace.getConfiguration("solidity").update("test.executeOnSave", false, false)
		}),
		vscode.commands.registerCommand("solidity.test.enableExecuteOnsave", () => {
			vscode.workspace.getConfiguration("solidity").update("test.executeOnSave", true, false)
		}),
		vscode.commands.registerCommand("solidity.test.enableTracing", () => {
			vscode.workspace.getConfiguration("solidity").update("test.verbosity", 4, false)
		}),
		vscode.commands.registerCommand("solidity.test.disableTracing", () => {
			vscode.workspace.getConfiguration("solidity").update("test.verbosity", 2, false)
		}),
		vscode.commands.registerCommand("solidity.enableValidateOnChange", () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnChange", true, false)
		}),
		vscode.commands.registerCommand("solidity.disableValidateOnChange", () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnChange", false, false)
		}),
		vscode.commands.registerCommand("solidity.enableValidateOnSave", () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnSave", true, false)
		}),
		vscode.commands.registerCommand("solidity.disableValidateOnSave", () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnSave", false, false)
		}),
		vscode.commands.registerCommand("solidity.enableValidateOnOpen", () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnOpen", true, false)
		}),
		vscode.commands.registerCommand("solidity.disableValidateOnOpen", () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnOpen", false, false)
		}),
		vscode.commands.registerCommand("solidity.disableAllValidation", () => {
			vscode.workspace.getConfiguration("solidity").update("validateOnOpen", false, false)
			vscode.workspace.getConfiguration("solidity").update("validateOnSave", false, false)
			vscode.workspace.getConfiguration("solidity").update("validateOnChange", false, false)
		}),
	)
}
