import { connection } from "@server"
import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import { getFunctionSelector, keccak256, toBytes } from "viem"
import { Diagnostic, ExecuteCommandParams, Range } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { ParsedError } from "./code/ParsedError"
import { ParsedFunction } from "./code/ParsedFunction"
import { CodeWalkerService } from "./codewalker"

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
		throw new Error(`lens.server.function.natspec failed: ${e.message}`)
	}
}
export const hash = (
	walker: CodeWalkerService,
	document?: TextDocument,
	range?: Range,
	params?: ExecuteCommandParams,
) => {
	try {
		const text = document.getText(range)
		return keccak256(toBytes(text))
	} catch (e) {
		throw new Error(`lens.server.string.keccak256 failed: ${e.message}`)
	}
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
		throw new Error(`lens.server.diagnostic.set failed: ${e.message}`)
	}
}
export const clearDiagnostic = (walker: CodeWalkerService) => {
	try {
		walker.parsedDocumentsCache.forEach((doc) => {
			connection.sendDiagnostics({ uri: doc.sourceDocument.absolutePath, diagnostics: [] })
		})
	} catch (e) {
		console.debug("Clear diagnostics", e.message)
		throw new Error(`lens.server.diagnostic.clear failed: ${e.message}`)
	}
}

const commandMap = {
	[SERVER_COMMANDS_LIST["diagnostic.clear"]]: clearDiagnostic,
	[SERVER_COMMANDS_LIST["diagnostic.set"]]: setDiagnostics,
	[SERVER_COMMANDS_LIST["string.keccak256"]]: hash,
	[SERVER_COMMANDS_LIST["function.selector"]]: funcSig,
	[SERVER_COMMANDS_LIST["function.natspec"]]: funcNatspec,
}
