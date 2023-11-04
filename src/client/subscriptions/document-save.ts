import { CLIENT_COMMAND_LIST } from "@client/commands/commands"
import { LensProvider } from "@client/context/register-code-lens"
import * as vscode from "vscode"

const versionMap = new Map<string, number>()
export const executeOnSave = () =>
	vscode.workspace.onDidSaveTextDocument(async (document) => {
		if (document.languageId !== "solidity") return

		if (
			document.fileName.endsWith(".sol") &&
			!document.fileName.endsWith(".t.sol") &&
			versionMap.get(document.fileName) !== document.version
		) {
			versionMap.set(document.fileName, document.version)
			vscode.commands.executeCommand(CLIENT_COMMAND_LIST["solidity.diagnostics.clear"], true, document)
		}

		if (
			document.fileName.endsWith(".t.sol") &&
			vscode.workspace.getConfiguration("solidity").get("test.executeOnSave", true)
		) {
			const position = vscode.window.activeTextEditor?.selection.active
			if (!position) return

			const lens = LensProvider.getCodeLensFromPosition(CLIENT_COMMAND_LIST["solidity.lens.function.test"], position)
			if (!lens || !lens.command?.arguments?.length) return

			return vscode.commands.executeCommand(lens.command.command, ...lens.command.arguments)
		}
	})
