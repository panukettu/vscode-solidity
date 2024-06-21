import type { ParsedContract } from "@server/code/ParsedContract"
import type { ParsedImport } from "@server/code/ParsedImport"
import { fuzzySearchByName } from "@server/search/fuzzy"
import { config } from "@server/server-config"
import { DocUtil } from "@server/utils/text-document"
import * as vscode from "vscode-languageserver/node"

type ActionDefinition = {
	code: string[]
	kinds: vscode.CodeActionKind[]
	regex?: () => RegExp
	regexpInner?: (...args: any[]) => RegExp
	data?: any
	createFix: (document: DocUtil, diagnostic: vscode.Diagnostic, data?: any) => vscode.CodeAction[]
}

const variableName: ActionDefinition = {
	code: ["7576"],
	kinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Empty],
	regex: () => new RegExp(/Did you mean "(?<variable>.*?)"((?=\s?)?.*?"(?<second>.*?)")?/, "gm"),
	createFix: (doc, diagnostic) => {
		const match = variableName.regex().exec(diagnostic.message)
		const diagnosticsFixed = [diagnostic]
		const result: vscode.CodeAction[] = []
		const wordRange = doc.wordRange(doc.range.start)

		if (match) {
			if (match.groups.variable) {
				const isPreferred = doc.lineHasCurrentWord(doc.getLine(diagnostic.range.start.line), doc.range)

				const fix = vscode.CodeAction.create(`Change to: ${match.groups.variable}`, vscode.CodeActionKind.QuickFix)
				fix.edit = {
					changes: doc.change({ replace: [{ range: wordRange, text: match.groups.variable }] }),
				}
				fix.diagnostics = diagnosticsFixed

				if (match.groups.second) {
					const fix2 = vscode.CodeAction.create(`Change to: ${match.groups.second}`, vscode.CodeActionKind.QuickFix)
					fix2.diagnostics = diagnosticsFixed
					fix2.edit = {
						changes: doc.change({ replace: [{ range: wordRange, text: match.groups.second }] }),
					}
					fix2.isPreferred = isPreferred
					result.push(fix2)
				} else {
					fix.isPreferred = isPreferred
				}
				result.push(fix)
				return result
			}
		}
		return createFuzzyNameFix(doc, diagnostic, wordRange)
	},
}

const createFuzzyNameFix = (
	doc: DocUtil,
	diagnostic: vscode.Diagnostic,
	range: vscode.Range,
	thresholdOverride?: number,
	preferredOverride?: boolean,
) => {
	// const wordRange = doc.wordRange(doc.range.start)
	const diagnosticsFixed = [diagnostic]
	const result: vscode.CodeAction[] = []
	const word = doc.toText(range)

	const foundMatches = fuzzySearchByName(word, doc.getSelectedDocument(), doc, true, thresholdOverride)
	if (foundMatches.length > 0) {
		const maxScore = Math.max(...foundMatches.map((m) => m.score))
		for (const m of foundMatches) {
			const fix = vscode.CodeAction.create(`Change to: ${m.match.name}`, vscode.CodeActionKind.QuickFix)
			fix.edit = {
				changes: doc.change({ replace: [{ range, text: m.match.name }] }),
			}
			fix.isPreferred = preferredOverride != null ? preferredOverride : m.score === maxScore
			fix.diagnostics = diagnosticsFixed
			result.push(fix)
		}
		return result
	}
	return null
}

const memberLookup: ActionDefinition = {
	code: ["9582"],
	kinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Empty],
	regex: () =>
		new RegExp(
			/Member "(?<variable>.*?)" not found or not visible after argument-dependent lookup in contract (?<contract>.*?).$/,
			"gm",
		),
	regexpInner: (min: number, max: number, variable: string) => new RegExp(`[${variable}]{${min},${max}}`, "g"),
	createFix: (doc, diagnostic) => {
		const match = memberLookup.regex().exec(diagnostic.message)
		const meta = doc.getLineMeta()
		if (match) {
			const result: vscode.CodeAction[] = []
			const diagnosticsFixed = [diagnostic]
			if (match?.groups?.variable && match?.groups?.contract) {
				const foundMatches = doc.findCache<{
					contract: ParsedContract
					matches: ReturnType<typeof fuzzySearchByName>
				}>((d) => {
					const contract = d.findContractByName(match.groups.contract)
					if (!contract) return { found: false, result: undefined }
					const matches = fuzzySearchByName(match.groups.variable, contract, doc, true)

					return {
						found: true,
						result: { contract, matches },
					}
				})
				const maxScore = Math.max(...foundMatches.matches.map((m) => m.score))
				for (const m of foundMatches.matches) {
					const isWrapper = meta.isWrapper(match.groups.contract)
					const fix = vscode.CodeAction.create(`Change to: ${m.match.name}`, vscode.CodeActionKind.QuickFix)
					const nextWord = doc.getNextWord()
					fix.edit = {
						changes: doc.change({
							replace: [{ range: isWrapper ? doc.getNextWord(nextWord.start) : nextWord, text: m.match.name }],
						}),
					}
					fix.isPreferred = m.score === maxScore
					fix.diagnostics = diagnosticsFixed
					result.push(fix)
				}

				return result
			}
		}

		const isTypeWrap =
			meta.isWrapper("type") ||
			meta.isWrapper("address") ||
			meta.isWrapper("uint256") ||
			meta.isWrapper("bytes32") ||
			meta.isWrapper("bytes")
		const nextWord = doc.getNextWord()
		return createFuzzyNameFix(doc, diagnostic, isTypeWrap ? doc.getNextWord(nextWord.start) : nextWord)
	},
}
type ImportResult = {
	import?: ParsedImport
	location: string
	isRelative?: boolean
	relativePath?: string
	importPath?: string
}

const importer: ActionDefinition = {
	code: ["7920", "7576", "9589"],
	kinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Empty],
	createFix: (doc, diagnostic): vscode.CodeAction[] => {
		try {
			const symbol = doc.getWord(diagnostic.range.start)

			/* -------------------------------------------------------------------- */
			/*                                get all                               */
			/* -------------------------------------------------------------------- */
			const imports = doc.filterMapCache<ImportResult>((document, results) => {
				const importFound = document.imports.find((i) => i.symbols.find((s) => s.name === symbol))
				if (importFound) {
					const location = DocUtil.toPath(importFound.getReferenceLocation().uri)
					if (!results.find((i) => i.location === location)) {
						const isRelative = importFound.document.sourceDocument.isImportLocal(importFound.from)
						return {
							found: true,
							result: {
								import: importFound,
								location,
								isRelative: isRelative,
								relativePath: importFound.getRelativePath(doc.path),
							},
						}
					}
				} else {
					const itemFound = document.getAllImportables().find((c) => c.name === symbol)
					if (itemFound) {
						const location = DocUtil.toPath(itemFound.document.sourceDocument.absolutePath)
						if (!results.find((i) => i.location === location)) {
							return {
								found: true,
								result: {
									import: undefined,
									location,
									importPath: itemFound.getRemappedOrRelativeImportPath(doc.path),
								},
							}
						}
					}
				}
				return { found: false, result: undefined }
			})

			/* -------------------------------------------------------------------- */
			/*                               get local                              */
			/* -------------------------------------------------------------------- */

			const selectedDocumentImports = doc
				.getSelectedDocument()
				.imports.map((d, i) => ({
					import: d,
					isRelative: d.document.sourceDocument.isImportLocal(d.from),
					relativePath: d.getRelativePath(doc.path),
					location: DocUtil.toPath(d.getReferenceLocation().uri),
					index: i,
				}))
				.filter((i) => imports.find((s) => s.location === i.location))

			/* -------------------------------------------------------------------- */
			/*                                create                                */
			/* -------------------------------------------------------------------- */

			const docImports = doc.getImports()
			const diagnosticsFixed = [diagnostic]
			/* ----------------------------- internals ---------------------------- */

			const internals = selectedDocumentImports.map((imp, i) => {
				const importPath = imp.isRelative ? imp.relativePath : imp.import.from
				const fix = vscode.CodeAction.create(`import from '${importPath}'`, vscode.CodeActionKind.QuickFix)
				fix.diagnostics = diagnosticsFixed
				fix.edit = {
					changes: docImports[imp.index].addSymbol(symbol),
				}
				fix.isPreferred = i === 0
				return fix
			})
			/* ----------------------------- externals ---------------------------- */
			const externals = imports.map((imp, i) => {
				const importPath = imp.importPath ? imp.importPath : imp.isRelative ? imp.relativePath : imp.import.from
				const fix = vscode.CodeAction.create(`import from '${importPath}'`, vscode.CodeActionKind.QuickFix)
				fix.diagnostics = diagnosticsFixed
				fix.edit = {
					changes:
						docImports.length > 0
							? docImports[docImports.length - 1].addNewBelow(symbol, importPath)
							: doc.addNewImport(symbol, importPath),
				}
				fix.isPreferred = i === 0 && internals.length === 0
				return fix
			})
			/* ------------------------------ return ------------------------------ */
			const result = [...internals, ...externals.filter((e) => !internals.find((i) => i.title === e.title))].filter(
				Boolean,
			)
			if (result.length) {
				return result.concat(
					createFuzzyNameFix(doc, diagnostic, doc.wordRange(), config.fuzzLevel.suggestionsWithImport, false),
				)
			} else if (diagnostic.code !== "7576") {
				return createFuzzyNameFix(doc, diagnostic, doc.wordRange())
			}
		} catch (e) {
			console.debug("Create fix", e)
		}
	},
}

const actions = [importer, variableName, memberLookup] as const

export const getCodeActionFixes = (document: DocUtil, diagnostics: vscode.Diagnostic[]) => {
	return diagnostics
		.filter((diagnostic) => actions.find((a) => a.code.includes(String(diagnostic.code))))
		.flatMap((diagnostic) => {
			return actions.flatMap((action) => {
				if (!action.code.includes(String(diagnostic.code))) return undefined
				return action.createFix(document, diagnostic)
			})
		})
		.filter(Boolean)
}
