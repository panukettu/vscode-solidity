import type { ClientState } from "@client/client-state"
import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import * as vscode from "vscode"

export const commandKeccak256 = (state: ClientState) => async (...args: any[]) => {
	const result = await vscode.commands.executeCommand<string>(SERVER_COMMANDS_LIST["string.keccak256"], ...args)
	return vscode.window.showInformationMessage(result)
}
