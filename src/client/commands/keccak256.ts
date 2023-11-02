import type { ClientState } from "@client/client-state"
import * as vscode from "vscode"

export const commandKeccak256 = (state: ClientState) => async (...args: any[]) => {
	const result = await vscode.commands.executeCommand<string>("solidity.server.lens.function.keccak256", ...args)
	return vscode.window.showInformationMessage(result)
}
