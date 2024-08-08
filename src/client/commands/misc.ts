import type { CommandInfo, Lens } from "@client/client-types"
import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import * as vscode from "vscode"
import { CLIENT_COMMAND_LIST } from "./commands-list"

const commandNatspec = async (...args: Lens.Natspec) => {
	const result: string = await vscode.commands.executeCommand(SERVER_COMMANDS_LIST["function.natspec"], ...args)
	return vscode.window.activeTextEditor.edit((editBuilder) => {
		const position = new vscode.Position(args[1].start.line, 0)
		editBuilder.insert(position, result)
	})
}

export default [[CLIENT_COMMAND_LIST["solidity.lens.function.natspec"], commandNatspec]] as CommandInfo[]
