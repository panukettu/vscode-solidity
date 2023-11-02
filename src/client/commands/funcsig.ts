import type { ClientState } from "@client/client-state"
import type { Lens } from "@client/client-types"
import * as vscode from "vscode"

export const commandFuncsig = (state: ClientState) => async (...args: Lens.Funcsig) => {
	const result: string = await vscode.commands.executeCommand("solidity.server.lens.function.selector", ...args)

	return vscode.window.showInformationMessage(result)
}
