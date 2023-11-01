import { ClientState } from '@client/client-state';
import { compileActiveFile } from '@client/compiler/compile-active';
import { compileAllContracts } from '@client/compiler/compile-all';
import { getCurrentWorkspaceRootFolder } from '@shared/config';
import { CompilerType } from '@shared/enums';
import * as vscode from 'vscode';

export function registerSolcCommands(state: ClientState) {
	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.changeSolcType', async () => {
			state.compilers.changeSolcType(vscode.ConfigurationTarget.Workspace);
		})
	);

	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.compile.active', () => {
			return compileActiveFile(state);
		})
	);
	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.compile.activeWithRemoteSolc', () => {
			return compileActiveFile(state, CompilerType.Remote);
		})
	);

	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.compile.activeWithLocalSolc', async () => {
			return compileActiveFile(state, CompilerType.File);
		})
	);

	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.compile.activeWithNPMSolc', async () => {
			return compileActiveFile(state, CompilerType.NPM);
		})
	);
	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.selectGlobalRemoteSolcVersion', async () => {
			state.compilers.selectRemoteVersion(vscode.ConfigurationTarget.Global);
		})
	);

	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.downloadSolcAndSetAsLocal', async () => {
			state.compilers.downloadSolcAndSetAsLocal(vscode.ConfigurationTarget.Workspace, getCurrentWorkspaceRootFolder());
		})
	);

	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.peekActiveCompilers', async () => {
			state.compilers.printInitializedCompilers();
		})
	);

	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.peekSolcReleases', async () => {
			state.compilers.printSolcReleases();
		})
	);

	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.selectWorkspaceRemoteSolcVersion', async () => {
			state.compilers.selectRemoteVersion(vscode.ConfigurationTarget.Workspace);
		})
	);

	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.downloadRemoteSolcVersion', async () => {
			const root = getCurrentWorkspaceRootFolder();
			state.compilers.downloadRemoteVersion(root);
		})
	);

	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.compile.all', () => {
			compileAllContracts(state);
		})
	);
}
