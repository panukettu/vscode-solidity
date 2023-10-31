import * as fs from 'fs';
import * as path from 'path';
import type { ClientState } from '@client/client-state';
import {
	Config,
	getCurrentProjectInWorkspaceRootFsPath,
	getCurrentWorkspaceRootFolder,
	getSolidityRemappings,
} from '@shared/config';
import { SourceDocumentCollection } from '@shared/model/sourceDocuments';
import { initialiseProject } from '@shared/project';
import type { SolidityConfig } from '@shared/types';
import { formatPath, isPathSubdirectory } from '@shared/util';
import * as vscode from 'vscode';

export function compileAllContracts(state: ClientState) {
	// Check if is folder, if not stop we need to output to a bin folder on rootPath
	if (getCurrentWorkspaceRootFolder() === undefined) {
		vscode.window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
		return;
	}
	const rootPath = getCurrentProjectInWorkspaceRootFsPath();

	const { libs, libSources } = Config.getLibs();

	const contractsCollection = new SourceDocumentCollection();
	const project = initialiseProject(rootPath, {
		libs,
		libSources,
		sources: Config.getSources(),
		remappings: getSolidityRemappings(),
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
	const options = Config.getCompilerOptions(packagesPath, sourceDirPath);
	const compileArgs = {
		solcInput: contractsCollection.getSolcInput(options),
		state,
		options,
		solcType: Config.getCompilerType(),
	};

	state.clientCompilers.compile(compileArgs);
}
