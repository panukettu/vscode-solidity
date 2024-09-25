import * as path from "node:path"
import { Config, getRootPath } from "@client/client-config"
import * as vscode from "vscode"

import type { ClientState } from "@client/client-state"
import type { BaseCommandArgs } from "@client/client-types"
import { Multisolc } from "@shared/compiler/multisolc"
import type { CompilerType } from "@shared/enums"
import { Project } from "@shared/project/project"

export async function compileActiveFile(
	state: ClientState,
	args: BaseCommandArgs,
	compilerOverride: CompilerType = null,
) {
	const editor = vscode.window.activeTextEditor

	if (!editor) return // We need something open

	if (path.extname(editor.document.fileName) !== ".sol") {
		vscode.window.showWarningMessage("This not a solidity file (*.sol)")
		return
	}

	const project = new Project(Config.all(), getRootPath())
	const document = project.addSource(editor.document.fileName, editor.document.getText())

	try {
		const settings = Multisolc.getSettings(project, {
			sources: project.contracts.getSolcInputSource(),
			outputs: Multisolc.selectSolcOutputs(project.solc.settings.output),
			type: compilerOverride,
			document,
		})

		return await state.compilers.compile(args, settings, settings.document.getImportCallback())
	} catch (e) {
		console.debug("compileActiveFile:", e.message)
		return []
	}
}
