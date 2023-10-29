import * as path from 'path';
import * as vscode from 'vscode';
import { SourceDocumentCollection } from '../common/model/sourceDocumentCollection';
import { initialiseProject } from '../common/projectService';
import { CompilerType } from '../common/solcCompiler';
import { formatPath } from '../common/util';
import { SolidityConfig } from '../server/types';
import { Compiler } from './compiler';
import { SettingsService } from './settingsService';
import * as workspaceUtil from './workspaceUtil';

let diagnosticCollection: vscode.DiagnosticCollection;

export function initDiagnosticCollection(diagnostics: vscode.DiagnosticCollection) {
	diagnosticCollection = diagnostics;
}

export async function compileActiveContract(
	compiler: Compiler,
	overrideDefaultCompiler: CompilerType = null
): Promise<Array<string>> {
	const editor = vscode.window.activeTextEditor;

	if (!editor) {
		return; // We need something open
	}

	if (path.extname(editor.document.fileName) !== '.sol') {
		vscode.window.showWarningMessage('This not a solidity file (*.sol)');
		return;
	}

	// Check if is folder, if not stop we need to output to a bin folder on rootPath
	if (workspaceUtil.getCurrentWorkspaceRootFolder() === undefined) {
		vscode.window.showWarningMessage('You need to open a folder (or workspace) :(');
		return;
	}

	try {
		const contractsCollection = new SourceDocumentCollection();
		const contractCode = editor.document.getText();
		const contractPath = editor.document.fileName;

		const sources = SettingsService.getSources();
		const outDir = SettingsService.getOutDir();
		const { libs, libSources } = SettingsService.getLibs();
		const compilationOptimisation = SettingsService.getCompilerOptimisation();
		const compilerType = SettingsService.getCompilerType();

		const project = initialiseProject(workspaceUtil.getCurrentProjectInWorkspaceRootFsPath(), {
			sources,
			libs,
			libSources,
			remappings: workspaceUtil.getSolidityRemappings(),
		} as SolidityConfig).project;

		const contract = contractsCollection.addSourceDocumentAndResolveImports(contractPath, contractCode, project);
		const packagesPath: string[] = [];
		if (project.libs.length > 0) {
			for (const lib of project.libs) {
				packagesPath.push(formatPath(lib));
			}
		}
		return compiler.compile({
			contracts: contractsCollection.getDefaultSourceDocumentsForCompilation(compilationOptimisation),
			diagnosticCollection,
			buildDir: outDir,
			rootDir: project.projectPackage.absoluletPath,
			sourceDir: null,
			excludePath: packagesPath,
			singleContractFilePath: contract.absolutePath,
			overrideDefaultCompiler: overrideDefaultCompiler || compilerType,
		});
	} catch (e) {
		console.debug('Unhandled:', e.message);
	}
}
