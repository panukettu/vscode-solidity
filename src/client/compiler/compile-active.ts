import * as path from 'path';
import {
	Config,
	getCurrentProjectInWorkspaceRootFsPath,
	getCurrentWorkspaceRootFolder,
	getSolidityRemappings,
} from '@shared/config';
import { SourceDocumentCollection } from '@shared/model/sourceDocuments';
import { initialiseProject } from '@shared/project';
import { formatPath } from '@shared/util';
import * as vscode from 'vscode';

import { ClientState } from '@client/client-state';
import { CompilerType } from '@shared/enums';
import type { SolidityConfig } from '@shared/types';

export function compileActiveFile(
	state: ClientState,
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
	if (getCurrentWorkspaceRootFolder() === undefined) {
		vscode.window.showWarningMessage('You need to open a folder (or workspace) :(');
		return;
	}

	try {
		const contractsCollection = new SourceDocumentCollection();
		const { libs, libSources } = Config.getLibs();
		const project = initialiseProject(getCurrentProjectInWorkspaceRootFsPath(), {
			sources: Config.getSources(),
			libs,
			libSources,
			remappings: getSolidityRemappings(),
		} as SolidityConfig).project;

		const contract = contractsCollection.addSourceDocumentAndResolveImports(
			editor.document.fileName,
			editor.document.getText(),
			project
		);

		const packagesPath = project.libs.map((lib) => formatPath(lib));
		const options = Config.getCompilerOptions(packagesPath, null, overrideDefaultCompiler);
		const compileArgs = {
			solcInput: contractsCollection.getSolcInput(options),
			state,
			options,
			contractPath: contract.absolutePath,
			solcType: overrideDefaultCompiler || Config.getCompilerType(),
		};

		state.clientCompilers.compile(compileArgs);
	} catch (e) {
		console.debug('Unhandled:', e.message);
	}
}
