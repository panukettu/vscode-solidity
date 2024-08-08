import { getClientState } from "@client/client-state"
import type { CommandInfo, Lens } from "@client/client-types"
import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import { type Hex, isHex } from "viem"
import * as vscode from "vscode"
import { CLIENT_COMMAND_LIST } from "./commands-list"

const get =
	(command: "function.selector" | "error.selectors" | "function.selectors") =>
	async (...args: Lens.Funcsig) => {
		if (!args.length) {
			const sel = vscode.window.activeTextEditor?.selection

			args = [vscode.window.activeTextEditor?.document, sel && ([sel.start, sel.end] as any)]
		}

		const result: string = await vscode.commands.executeCommand(SERVER_COMMANDS_LIST[command], ...args)
		await vscode.env.clipboard.writeText(result)
		return vscode.window.showInformationMessage(result)
	}
const find = async () => {
	const input = await vscode.window.showInputBox({
		placeHolder: "Enter the function signature",
		validateInput(value) {
			if (!value) return "Please enter a function signature"
			if (!isHex(value)) return "Please enter a valid 4-byte hex string"
			if (value.length !== 10) return "Invalid length, must be 4 bytes"
		},
	})
	if (!input) return

	const result = await getClientState().send({
		type: "selector.find",
		args: { selector: input as Hex },
	})

	if (typeof result === "string") return vscode.window.showErrorMessage(result)

	const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(result.uri))
	await vscode.window.showTextDocument(doc, {
		selection: new vscode.Range(
			result.range.start.line,
			result.range.start.character,
			result.range.end.line,
			result.range.end.character,
		),
	})
}
export const selectorCommands: CommandInfo[] = [
	[CLIENT_COMMAND_LIST["solidity.lens.function.selector"], get("function.selector")],
	[CLIENT_COMMAND_LIST["solidity.lens.function.selectors"], get("function.selectors")],
	[CLIENT_COMMAND_LIST["solidity.lens.error.selectors"], get("error.selectors")],
	[CLIENT_COMMAND_LIST["solidity.find.selector"], find],
]
