import { getCodeWalkerService } from "@server/server-utils"
import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import type { Diagnostic, ExecuteCommandParams, Range } from "vscode-languageserver"
import type { TextDocument } from "vscode-languageserver-textdocument"
import { ParsedError } from "../code/ParsedError"
import { ParsedFunction } from "../code/ParsedFunction"
import type { CodeWalkerService } from "../codewalker"
import { request } from "./requests"
import { getSelector, hash } from "./shared"

export const execInputCommand = (params: ExecuteCommandParams) => {
	return commandMap[params.command](params)
}

export const executeCommand = (params?: ExecuteCommandParams, document?: TextDocument, range?: Range) => {
	const walker = getCodeWalkerService()
	return commandMap[params.command](walker, document, range, params)
}

const getSelectorFromRange = (walker: CodeWalkerService, document?: TextDocument, range?: Range) => {
	try {
		const selected = walker.getSelectedDocument(document, range.start)
		return getSelector(selected.getSelectedItem(document.offsetAt(range.start)))
	} catch (e) {
		throw new Error(`func-selector failed: ${e.message}`)
	}
}

const getAllSelectors = (err: boolean) => (walker: CodeWalkerService, document?: TextDocument, range?: Range) => {
	try {
		const selected = walker.getSelectedDocument(document, range.start)
		const allItems = err
			? selected.getAllGlobalErrors()
			: selected.getAllGlobalFunctions(false).concat(selected.innerContracts.flatMap((x) => x.getAllFunctions(false)))

		const selectors = allItems
			.filter((x) => x instanceof ParsedFunction || x instanceof ParsedError)
			.map((i) => {
				const selector = i.getSelector()
				const loc = i.getLocation?.()
				return {
					name: i.name,
					sig: selector,
					uri: loc?.uri ?? document.uri,
					range: loc.range,
					selector: getSelector(selector),
				}
			})
			.filter((s, i, a) => a.findIndex((x) => x.selector === s.selector) === i)

		const byUri = selectors.reduce(
			(acc, x) => {
				if (!acc[x.uri]) acc[x.uri] = []
				const [name, args] = x.sig.split("(")
				acc[x.uri].push({
					message: x.selector,
					range: { start: x.range.start, end: { line: x.range.start.line, character: 9999 } },
					severity: 3,
					source: args ? name : `${name}()`,
					code: args?.replace(")", ""),
				})
				return acc
			},
			{} as Record<string, Diagnostic[]>,
		)

		request["diagnostics.set"]({ diagnostics: Object.entries(byUri), openProblems: true })

		return selectors.map((x) => `${x.name}: ${x.selector}`).join("\n")
	} catch (e) {
		throw new Error(`lens-selectors fail: ${e.message}`)
	}
}
const funcNatspec = (walker: CodeWalkerService, document?: TextDocument, range?: Range) => {
	try {
		const selected = walker.getSelectedDocument(document, range.start)
		const func = selected.getSelectedFunction(document.offsetAt(range.start))
		return func.generateNatSpec()
	} catch (e) {
		throw new Error(`lens-natspec fai: ${e.message}`)
	}
}

const commandMap = {
	[SERVER_COMMANDS_LIST["function.selector"]]: getSelectorFromRange,
	[SERVER_COMMANDS_LIST["error.selectors"]]: getAllSelectors(true),
	[SERVER_COMMANDS_LIST["function.selectors"]]: getAllSelectors(false),
	[SERVER_COMMANDS_LIST["function.natspec"]]: funcNatspec,
}
