import * as path from "node:path"
import { Config, getCurrentProjectInWorkspaceRootFsPath, getCurrentWorkspaceRootFolder } from "@client/client-config"
import type { ClientState } from "@client/client-state"
import type { BaseCommandArgs } from "@client/client-types"
import { Multisolc } from "@shared/compiler/multisolc"
import { Project } from "@shared/project/project"
import type { SourceDocument } from "@shared/project/sourceDocument"
import { isPathSubdirectory } from "@shared/util"
import * as vscode from "vscode"

export function compileAllContracts(state: ClientState, commandArgs: BaseCommandArgs) {
	// Check if is folder, if not stop we need to output to a bin folder on rootPath
	if (getCurrentWorkspaceRootFolder() === undefined) {
		vscode.window.showWarningMessage("Please open a folder in Visual Studio Code as a workspace")
		return
	}
	const rootPath = getCurrentProjectInWorkspaceRootFsPath()

	const project = new Project(Config.all(), rootPath)

	// Process open Text Documents first as it is faster (We might need to save them all first? Is this assumed?)
	const [activeDocument] = commandArgs
	let activeSource: SourceDocument
	for (const document of vscode.workspace.textDocuments) {
		if (!isPathSubdirectory(rootPath, document.fileName)) continue
		if (path.extname(document.fileName) !== ".sol") continue

		const doc = project.addSource(document.fileName, document.getText())
		if (activeDocument.fileName === document.fileName) activeSource = doc
	}

	const remaining = (project?.getProjectSolFiles() ?? []).filter((f) => !project.contracts.containsSourceDocument(f))

	for (const document of remaining) project.addSource(document, null)

	const compilerOpts = Multisolc.getSettings(project, {
		exclusions: project.libs,
		document: activeSource,
		outputs: Multisolc.selectSolcOutputs(project.solc.settings.output),
	})

	return state.compilers.compile(commandArgs, compilerOpts, project.getImportCallback(activeSource))
}
