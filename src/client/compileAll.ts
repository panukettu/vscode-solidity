import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SourceDocumentCollection } from '../common/model/sourceDocumentCollection';
import { initialiseProject } from '../common/projectService';
import { formatPath, isPathSubdirectory } from '../common/util';
import { SolidityConfig } from '../server/types';
import { Compiler } from './compiler';
import { SettingsService } from './settingsService';
import * as workspaceUtil from './workspaceUtil';

export function compileAllContracts(compiler: Compiler, diagnosticCollection: vscode.DiagnosticCollection) {
	// Check if is folder, if not stop we need to output to a bin folder on rootPath
	if (workspaceUtil.getCurrentWorkspaceRootFolder() === undefined) {
		vscode.window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
		return;
	}
	const rootPath = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
	const compilationOptimisation = SettingsService.getCompilerOptimisation();
	const remappings = workspaceUtil.getSolidityRemappings();

	const sources = SettingsService.getSources();
	const { libs, libSources } = SettingsService.getLibs();
	const contractsCollection = new SourceDocumentCollection();
	const project = initialiseProject(rootPath, {
		libs,
		libSources,
		sources,
		remappings,
	} as SolidityConfig).project;

	// Process open Text Documents first as it is faster (We might need to save them all first? Is this assumed?)

	for (const document of vscode.workspace.textDocuments) {
		if (isPathSubdirectory(rootPath, document.fileName)) {
			if (path.extname(document.fileName) === '.sol') {
				const contractPath = document.fileName;
				const contractCode = document.getText();
				contractsCollection.addSourceDocumentAndResolveImports(contractPath, contractCode, project);
			}
		}
	}

	const documents = project.getProjectSolFiles();

	for (const document of documents) {
		const contractPath = document;
		if (!contractsCollection.containsSourceDocument(contractPath)) {
			const contractCode = fs.readFileSync(contractPath, 'utf8');
			contractsCollection.addSourceDocumentAndResolveImports(contractPath, contractCode, project);
		}
	}

	const sourceDirPath = formatPath(project.projectPackage.getSolSourcesAbsolutePath());
	const packagesPath: string[] = [];
	if (project.libs.length > 0) {
		for (const lib of project.libs) {
			packagesPath.push(formatPath(lib));
		}
	}

	compiler.compile({
		contracts: contractsCollection.getDefaultSourceDocumentsForCompilation(compilationOptimisation),
		diagnosticCollection,
		buildDir: project.projectPackage.build_dir,
		rootDir: project.projectPackage.absoluletPath,
		sourceDir: sourceDirPath,
		excludePath: packagesPath,
	});
}
