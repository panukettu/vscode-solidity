import * as vscode from 'vscode';
import { CompilerType } from '../../common/solcCompiler';
import { compileActiveContract, initDiagnosticCollection } from '../compileActive';
import { compileAllContracts } from '../compileAll';
import { Compiler } from '../compiler';
import { formatDocument } from '../formatter/formatter';
import * as workspaceUtil from '../workspaceUtil';
import { initTestDiagnosticCollection, runForgeTest } from '../formatter/forgeFormatter';
import { initDecorations } from '../decorations';
import { CodelensProvider } from '../codeActionProviders/lensProvider';

export function baseSubscriptions(context: vscode.ExtensionContext): [Compiler, vscode.DiagnosticCollection] {
	const compiler = new Compiler(context.extensionPath);
	const diagnosticCollection = vscode.languages.createDiagnosticCollection('solidity');
	const diagnosticCollectionTest = vscode.languages.createDiagnosticCollection('solidity-test');
	context.subscriptions.push(diagnosticCollection);
	context.subscriptions.push(diagnosticCollectionTest);

	initTestDiagnosticCollection(diagnosticCollectionTest);
	initDiagnosticCollection(diagnosticCollection);

	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.compile.active', async () => {
			const compiledResults = await compileActiveContract(compiler);
			return compiledResults;
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.compile.activeUsingRemote', async () => {
			const compiledResults = await compileActiveContract(compiler, CompilerType.Remote);
			return compiledResults;
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.selectGlobalRemoteSolcVersion', async () => {
			compiler.selectRemoteVersion(vscode.ConfigurationTarget.Global);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.changeDefaultCompilerType', async () => {
			compiler.changeDefaultCompilerType(vscode.ConfigurationTarget.Workspace);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.compile.activeUsingLocalFile', async () => {
			const compiledResults = await compileActiveContract(compiler, CompilerType.File);
			return compiledResults;
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.compile.activeUsingNodeModule', async () => {
			const compiledResults = await compileActiveContract(compiler, CompilerType.NPM);
			return compiledResults;
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.downloadRemoteVersionAndSetLocalPathSetting', async () => {
			const root = workspaceUtil.getCurrentWorkspaceRootFolder();
			compiler.downloadRemoteVersionAndSetLocalPathSetting(vscode.ConfigurationTarget.Workspace, root);
		})
	);
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider('solidity', {
			async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
				return await formatDocument(document, context);
			},
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.compile', () => {
			compileAllContracts(compiler, diagnosticCollection);
		})
	);

	// context.subscriptions
	// 	.push
	// 	// vscode.commands.registerCommand('solidity.fixDocument', () => {
	// 	// 	// lintAndfixCurrentDocument();
	// 	// })
	// 	();

	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.compilerInfo', async () => {
			await compiler.outputCompilerInfoEnsuringInitialised();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.solcReleases', async () => {
			compiler.outputSolcReleases();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.selectWorkspaceRemoteSolcVersion', async () => {
			compiler.selectRemoteVersion(vscode.ConfigurationTarget.Workspace);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('solidity.downloadRemoteSolcVersion', async () => {
			const root = workspaceUtil.getCurrentWorkspaceRootFolder();
			compiler.downloadRemoteVersion(root);
		})
	);

	return [compiler, diagnosticCollection];
}
