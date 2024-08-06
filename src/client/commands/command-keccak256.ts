import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import type { Hex } from "viem"
import * as vscode from "vscode"

export const commandKeccak256 = async (...args: any[]) => {
	const result = await vscode.commands.executeCommand<string>(SERVER_COMMANDS_LIST["string.keccak256"], ...args)
	return vscode.window.showInformationMessage(result)
}
export const commandKeccak256Input = async (...args: any[]) => {
	const input = await vscode.window.showInputBox({ placeHolder: "what to hash" })
	if (!input) return

	const result = await vscode.commands.executeCommand<{ hash: Hex; hex: boolean }>(
		SERVER_COMMANDS_LIST["input.keccak256"],
		input,
	)
	// clipboard

	await vscode.env.clipboard.writeText(result.hash)
	return vscode.window.showInformationMessage(`${result.hex ? "(hex) " : ""}${input}: ${result.hash}`)
}
export const commandEncode = async (...args: any[]) => {
	const types = await vscode.window.showInputBox({
		placeHolder: "types to encode eg. `address, uint256, address`",
	})

	const values = await vscode.window.showInputBox({
		placeHolder: "values, comma separated eg. `0x123, 123, 0x123`",
	})

	const result = await vscode.commands.executeCommand<Hex>(SERVER_COMMANDS_LIST["input.encode"], types, values)
	await vscode.env.clipboard.writeText(result)
	return vscode.window.showInformationMessage(`(${types})[${values}]) ${result}`)
}

export const commandDecode = async (...args: any[]) => {
	const types = await vscode.window.showInputBox({
		placeHolder: "types to decode eg. `address, uint256, address`",
	})

	const value = await vscode.window.showInputBox({
		placeHolder: "bytes to decode",
	})

	const result = await vscode.commands.executeCommand<Hex>(SERVER_COMMANDS_LIST["input.decode"], types, value)
	await vscode.env.clipboard.writeText(result)
	return vscode.window.showInformationMessage(`(${types})[${result}]) ${value}`)
}
