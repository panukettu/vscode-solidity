import * as path from "node:path"
import { Config, getCurrentProjectInWorkspaceRootFsPath, getCurrentWorkspaceRootFolder } from "@client/client-config"
import type { ClientState } from "@client/client-state"
import type { BaseCommandArgs } from "@client/client-types"
import { Project } from "@shared/project/project"
import type { SourceDocument } from "@shared/project/sourceDocument"
import { SourceDocumentCollection } from "@shared/project/sourceDocuments"
import { formatPath, isPathSubdirectory } from "@shared/util"
import * as vscode from "vscode"

export function compileAllContracts(state: ClientState, commandArgs: BaseCommandArgs) {
	// Check if is folder, if not stop we need to output to a bin folder on rootPath
	if (getCurrentWorkspaceRootFolder() === undefined) {
		vscode.window.showWarningMessage("Please open a folder in Visual Studio Code as a workspace")
		return
	}
	const rootPath = getCurrentProjectInWorkspaceRootFsPath()

	const config = Config.getConfig()

	const contractsCollection = new SourceDocumentCollection()
	const project = new Project(config, rootPath)

	// Process open Text Documents first as it is faster (We might need to save them all first? Is this assumed?)
	const [activeDocument] = commandArgs
	let activeSource: SourceDocument
	for (const document of vscode.workspace.textDocuments) {
		if (!isPathSubdirectory(rootPath, document.fileName)) continue
		if (path.extname(document.fileName) !== ".sol") continue

		const doc = contractsCollection.addSourceDocumentAndResolveImports(document.fileName, document.getText(), project)
		if (activeDocument.fileName === document.fileName) {
			activeSource = doc
		}
	}

	const remaining = (project?.getProjectSolFiles() ?? []).filter((f) => !contractsCollection.containsSourceDocument(f))

	for (const document of remaining) {
		contractsCollection.addSourceDocumentAndResolveImports(document, null, project)
	}

	const compilerOpts = Config.getCompilerOptions(
		project.libs.map((lib) => formatPath(lib)),
		formatPath(project.projectPackage.getSolSourcesAbsolutePath()),
	)

	return state.compilers.compile(commandArgs, {
		solcInput: contractsCollection.getSolcInput(compilerOpts),
		state,
		options: compilerOpts,
		contract: activeSource,
		solcType: Config.getCompilerType(),
	})
}
