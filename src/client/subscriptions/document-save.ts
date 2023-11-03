import { CLIENT_COMMAND_LIST } from "@client/commands/list"
import { LensProvider } from "@client/context/register-code-lens"
import * as vscode from "vscode"

export const executeOnSave = () =>
	vscode.workspace.onDidSaveTextDocument(async (e) => {
		if (e.languageId === "solidity" && e.fileName.endsWith(".t.sol")) {
			const isEnabled = vscode.workspace.getConfiguration("solidity").get("test.executeOnSave", true)
			if (!isEnabled) return

			const position = vscode.window.activeTextEditor?.selection.active
			if (!position) return

			const lens = LensProvider.getCodeLensFromPosition(CLIENT_COMMAND_LIST["solidity.lens.function.test"], position)
			if (!lens || !lens.command?.arguments?.length) return

			vscode.commands.executeCommand(lens.command.command, ...lens.command.arguments)
		}
		if (e.languageId === "solidity" && e.fileName.endsWith(".sol")) {
			vscode.commands.executeCommand(CLIENT_COMMAND_LIST["solidity.diagnostics.clear"], true)
		}
	})
