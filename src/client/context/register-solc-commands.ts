import { getCurrentWorkspaceRootFolder } from "@client/client-config"
import { ClientState } from "@client/client-state"
import { CLIENT_COMMAND_LIST } from "@client/commands/list"
import { compileActiveFile } from "@client/compiler/compile-active"
import { compileAllContracts } from "@client/compiler/compile-all"
import { CompilerType } from "@shared/enums"
import * as vscode from "vscode"

export function registerSolcCommands(state: ClientState) {
	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.changeSolcType"], async () => {
			state.compilers.changeSolcType(vscode.ConfigurationTarget.Workspace)
		}),
	)

	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.compile.active"], () => {
			return compileActiveFile(state)
		}),
	)
	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.compile.activeWithRemoteSolc"], () => {
			return compileActiveFile(state, CompilerType.Remote)
		}),
	)
	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.compile.activeWithLocalSolc"], async () => {
			return compileActiveFile(state, CompilerType.File)
		}),
	)

	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.compile.activeWithNPMSolc"], async () => {
			return compileActiveFile(state, CompilerType.NPM)
		}),
	)
	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.selectGlobalRemoteSolcVersion"], async () => {
			state.compilers.selectRemoteVersion(vscode.ConfigurationTarget.Global)
		}),
	)

	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.downloadSolcAndSetAsLocal"], async () => {
			state.compilers.downloadSolcAndSetAsLocal(vscode.ConfigurationTarget.Workspace, getCurrentWorkspaceRootFolder())
		}),
	)

	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.peekActiveCompilers"], async () => {
			state.compilers.printInitializedCompilers()
		}),
	)

	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.peekSolcReleases"], async () => {
			state.compilers.printSolcReleases()
		}),
	)

	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.selectWorkspaceRemoteSolcVersion"], async () => {
			state.compilers.selectRemoteVersion(vscode.ConfigurationTarget.Workspace)
		}),
	)

	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.downloadRemoteSolcVersion"], async () => {
			const root = getCurrentWorkspaceRootFolder()
			state.compilers.downloadRemoteVersion(root)
		}),
	)

	state.context.subscriptions.push(
		vscode.commands.registerCommand(CLIENT_COMMAND_LIST["solidity.compile.all"], () => {
			compileAllContracts(state)
		}),
	)
}
