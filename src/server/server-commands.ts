import { connection } from "@server"
import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import { type Hex, decodeAbiParameters, getFunctionSelector, isHex, keccak256, toBytes } from "viem"
import { encodeAbiParameters, parseAbiParameters } from "viem"
import * as vscode from "vscode-languageserver"
import type { Diagnostic, ExecuteCommandParams, Range } from "vscode-languageserver"
import type { TextDocument } from "vscode-languageserver-textdocument"
import { ParsedError } from "./code/ParsedError"
import { ParsedFunction } from "./code/ParsedFunction"
import type { CodeWalkerService } from "./codewalker"
export const execInputCommand = (params: ExecuteCommandParams) => {
	return commandMap[params.command](params)
}
export const executeCommand = (
	walker: CodeWalkerService,
	params?: ExecuteCommandParams,
	document?: TextDocument,
	range?: Range,
) => {
	return commandMap[params.command](walker, document, range, params)
}

const funcSig = (walker: CodeWalkerService, document?: TextDocument, range?: Range, params?: ExecuteCommandParams) => {
	try {
		const selected = walker.getSelectedDocument(document, range.start)
		const item = selected.getSelectedItem(document.offsetAt(range.start))

		if (item instanceof ParsedFunction || item instanceof ParsedError) {
			return getFunctionSelector(item.getSelector())
		}
	} catch (e) {
		throw new Error(`lens.server.function.selector failed: ${e.message}`)
	}
}
const funcSigs =
	(err: boolean) =>
	(walker: CodeWalkerService, document?: TextDocument, range?: Range, params?: ExecuteCommandParams) => {
		try {
			const selected = walker.getSelectedDocument(document, range.start)
			const allItems = err
				? selected.getAllGlobalErrors()
				: selected.getAllGlobalFunctions(false).concat(selected.innerContracts.flatMap((x) => x.getAllFunctions(false)))

			const selectors = allItems
				.filter((x) => x instanceof ParsedFunction || x instanceof ParsedError)
				.map((i) => ({
					name: i.name,
					sig: i.getSelector(),
					range: i.getLocation().range,
					selector: getFunctionSelector(i.getSelector()),
				}))
				.filter((s, i, a) => a.findIndex((x) => x.selector === s.selector) === i)

			const diagnostics: Diagnostic[] = selectors.map((x) => ({
				message: x.selector,
				range: { start: x.range.start, end: { line: x.range.start.line, character: 9999 } },
				severity: 3,
				source: x.sig,
				code: err ? "error" : "func",
			}))
			connection.sendDiagnostics({ uri: document.uri, diagnostics })

			return selectors.map((x) => `${x.name}: ${x.selector}`).join("\n")
		} catch (e) {
			throw new Error(`lens-selectors fail: ${e.message}`)
		}
	}
const funcNatspec = (
	walker: CodeWalkerService,
	document?: TextDocument,
	range?: Range,
	params?: ExecuteCommandParams,
) => {
	try {
		const selected = walker.getSelectedDocument(document, range.start)
		const func = selected.getSelectedFunction(document.offsetAt(range.start))
		return func.generateNatSpec()
	} catch (e) {
		throw new Error(`lens-natspec fai: ${e.message}`)
	}
}

export const hashInput = (params: ExecuteCommandParams) => {
	if (params.command === SERVER_COMMANDS_LIST["input.keccak256"]) {
		const input = params.arguments[0] as string
		const hex = isHex(input)
		return { hash: keccak256(hex ? input : toBytes(input)), hex }
	}
}

export const hashText = (
	walker: CodeWalkerService,
	document?: TextDocument,
	range?: Range,
	params?: ExecuteCommandParams,
) => {
	try {
		return keccak256(toBytes(document.getText(range)))
	} catch (e) {
		throw new Error(`lens-keccak256 fail: ${e.message}`)
	}
}
export const encode = (params: ExecuteCommandParams) => {
	try {
		const [type, value] = params.arguments as [types: string, values: string]
		const values = value.split(",").map((x) => x.trim())
		return sendOutput("encode", encodeAbiParameters(parseAbiParameters(type), values), `(${type})[${value}]`)
	} catch (e) {
		throw new Error(`lens-encode fail: ${e.message}`)
	}
}
export const decode = (params: ExecuteCommandParams) => {
	try {
		const [type, value] = params.arguments as [types: string, value: Hex]
		const result = decodeAbiParameters(parseAbiParameters(type), value)

		return sendOutput("decode", result.join(", "))
	} catch (e) {
		throw new Error(`lens-encode fail: ${e.message}`)
	}
}
const sendOutput = (action: string, result: string, source?: string) => {
	// connection.sendDiagnostics({
	// 	uri: vscode.document.uri.toString(),
	// 	diagnostics: [
	// 		{
	// 			message: result,
	// 			range: { start: { line: 0, character: 0 }, end: { line: 0, character: 9999 } },
	// 			severity: 3,
	// 			source,
	// 			code: action,
	// 		},
	// 	],
	// })

	return result
}
export const setDiagnostics = (
	walker: CodeWalkerService,
	document?: TextDocument,
	range?: Range,
	params?: ExecuteCommandParams,
) => {
	try {
		const [, , diagnostics] = params.arguments as [any, any, [string, Diagnostic[]][]]
		diagnostics.forEach(([uri, diagnostics]) => {
			connection.sendDiagnostics({ uri, diagnostics })
		})
	} catch (e) {
		console.debug("Set diagnostics", e.message)
		throw new Error(`lens-diagnostic.set fail: ${e.message}`)
	}
}
export const clearDiagnostic = (walker: CodeWalkerService) => {
	try {
		walker.parsedDocumentsCache.forEach((doc) => {
			connection.sendDiagnostics({ uri: doc.sourceDocument.absolutePath, diagnostics: [] })
		})
	} catch (e) {
		console.debug("Clear diagnostics", e.message)
		throw new Error(`lens.diagnostic.clear fail: ${e.message}`)
	}
}

const commandMap = {
	[SERVER_COMMANDS_LIST["input.encode"]]: encode,
	[SERVER_COMMANDS_LIST["input.decode"]]: decode,
	[SERVER_COMMANDS_LIST["input.keccak256"]]: hashInput,
	[SERVER_COMMANDS_LIST["string.keccak256"]]: hashText,
	[SERVER_COMMANDS_LIST["diagnostic.clear"]]: clearDiagnostic,
	[SERVER_COMMANDS_LIST["diagnostic.set"]]: setDiagnostics,
	[SERVER_COMMANDS_LIST["function.selector"]]: funcSig,
	[SERVER_COMMANDS_LIST["error.selectors"]]: funcSigs(true),
	[SERVER_COMMANDS_LIST["function.selectors"]]: funcSigs(false),
	[SERVER_COMMANDS_LIST["function.natspec"]]: funcNatspec,
}
