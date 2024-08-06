import type { ClientState } from "@client/client-state"
import type { Lens } from "@client/client-types"
import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import * as vscode from "vscode"

export const commandFuncsig =
	(state: ClientState, command: "function.selector" | "error.selectors" | "function.selectors") =>
	async (...args: Lens.Funcsig) => {
		// const result: string = await vscode.commands.executeCommand("solidity.server.lens.function.selector", ...args)
		const result: string = await vscode.commands.executeCommand(SERVER_COMMANDS_LIST[command], ...args)
		await vscode.env.clipboard.writeText(result)
		return vscode.window.showInformationMessage(result)
	}
