import { getClientState } from "@client/client-state"
import type { CommandInfo } from "@client/client-types"
import { isHex } from "viem"
import * as vscode from "vscode"
import { CLIENT_COMMAND_LIST } from "./commands-list"

const getInputHash = async () => {
	const input = await vscode.window.showInputBox({ placeHolder: "what to hash" })
	if (!input) return

	const result = await getClientState().send({
		type: "keccak256",
		args: { input },
	})

	await vscode.env.clipboard.writeText(result.hash)
	return vscode.window.showInformationMessage(`${result.hex ? "(hex) " : ""}${input}: ${result.hash}`)
}

const validTypes = (value: string) => {
	const values = value.split(",")
	return values.map((i) => i.trim()).filter((i) => i.search(/\W/) === -1).length
}

const commandEncode = async () => {
	const types = await vscode.window.showInputBox({
		placeHolder: "types to encode eg. `address, uint256, address`",
		validateInput(value) {
			if (!value) return "Required"
			if (!validTypes(value)) return "Invalid values"
		},
	})

	const values = await vscode.window.showInputBox({
		placeHolder: "values, comma separated eg. `0x123, 123, 0x123`",
		validateInput(value) {
			if (!value) return "Required"
			const len = validTypes(types)
			if (value.split(",").length !== len) return `Specify ${len} values.`
		},
	})

	const result = await getClientState().send({
		type: "encode",
		args: { input: [types, values] },
	})

	await vscode.env.clipboard.writeText(result)

	return vscode.window.showInformationMessage(`(${types})[${values}]) ${result}`)
}

const commandDecode = async () => {
	const types = await vscode.window.showInputBox({
		placeHolder: "types to decode eg. `address, uint256, address`",
		validateInput(value) {
			if (!value) return "Required"
			if (!validTypes(value)) return "Invalid types"
		},
	})

	const value = await vscode.window.showInputBox({
		placeHolder: "bytes to decode",
		validateInput(value) {
			if (!value) return "Required"
			if (!isHex(value)) return "Invalid hex input"
		},
	})

	if (!isHex(value)) return vscode.window.showErrorMessage("Invalid hex input")

	const result = await getClientState().send({
		type: "decode",
		args: { input: [types, value] },
	})

	await vscode.env.clipboard.writeText(result)
	return vscode.window.showInformationMessage(`(${types}) ${result} | ${value}`)
}

export default [
	[CLIENT_COMMAND_LIST["solidity.input.keccak256"], getInputHash],
	[CLIENT_COMMAND_LIST["solidity.input.encode"], commandEncode],
	[CLIENT_COMMAND_LIST["solidity.input.decode"], commandDecode],
] as CommandInfo[]
