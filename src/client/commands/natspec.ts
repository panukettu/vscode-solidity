import type { ClientState } from "@client/client-state"
import { Lens } from "@client/client-types"
import * as vscode from "vscode"

export const commandNatspec = (state: ClientState) => async (...args: Lens.Natspec) => {
	const result: string = await vscode.commands.executeCommand("solidity.server.lens.function.natspec", ...args)
	return vscode.window.activeTextEditor.edit((editBuilder) => {
		const position = new vscode.Position(args[1].start.line, 0)
		editBuilder.insert(position, result)
	})
}
