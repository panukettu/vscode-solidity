import * as path from "path"
import { Config, getCurrentProjectInWorkspaceRootFsPath, getCurrentWorkspaceRootFolder } from "@client/client-config"
import { SourceDocumentCollection } from "@shared/project/sourceDocuments"
import { formatPath } from "@shared/util"
import * as vscode from "vscode"

import { ClientState } from "@client/client-state"
import { BaseCommandArgs } from "@client/client-types"
import { CompilerType } from "@shared/enums"
import { Project } from "@shared/project/project"

export async function compileActiveFile(
	state: ClientState,
	args: BaseCommandArgs,
	compilerOverride: CompilerType = null,
): Promise<Array<string>> {
	const editor = vscode.window.activeTextEditor

	if (!editor) {
		return // We need something open
	}

	if (path.extname(editor.document.fileName) !== ".sol") {
		vscode.window.showWarningMessage("This not a solidity file (*.sol)")
		return
	}

	// Check if is folder, if not stop we need to output to a bin folder on rootPath
	if (getCurrentWorkspaceRootFolder() == null) {
		vscode.window.showWarningMessage("You need to open a folder (or workspace) :(")
		return
	}

	try {
		const contractsCollection = new SourceDocumentCollection()

		const project = new Project(Config.getFullConfig(), getCurrentProjectInWorkspaceRootFsPath())
		const contract = contractsCollection.addSourceDocumentAndResolveImports(
			editor.document.fileName,
			editor.document.getText(),
			project,
		)

		const packagesPath = project.libs.map((lib) => formatPath(lib))
		const compilerOpts = Config.getCompilerOptions(packagesPath, null, compilerOverride)

		return state.compilers.compile(args, {
			solcInput: contractsCollection.getSolcInput(compilerOpts),
			state,
			options: compilerOpts,
			contract,
			solcType: compilerOverride || Config.getCompilerType(),
		})
	} catch (e) {
		console.debug("Unhandled:", e.message)
	}
}
