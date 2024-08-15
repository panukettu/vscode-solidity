import path from "node:path"
import type { ParsedContract } from "@server/code/ParsedContract"
import type { ParsedImport } from "@server/code/ParsedImport"
import { fuzzySearchByName } from "@server/search/fuzzy"
import { getConfig } from "@server/server-config"
import { DocUtil } from "@server/utils/text-document"
import Fuse from "fuse.js"
import * as vscode from "vscode-languageserver/node"

type ActionDefinition = {
	code: string[]
	lookup?: string
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
const wrongImport: ActionDefinition = {
	code: ["6275"],
	kinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Empty],
	regex: () => new RegExp(/Source "(?<wrongPath>.*?)" not found:/, "gm"),
	createFix: (doc, diagnostic) => {
		const match = wrongImport.regex().exec(diagnostic.message)

		const toReplace = match.groups.wrongPath
		if (!toReplace) return null

		const wordRange = doc.getRangeInLine(diagnostic.range.start.line, toReplace)
		const opts = diagnostic.message
			.split("Suggestions:\n")[1]
			.split("\n")
			.map((s) => s.trim())

		return opts.map((opt, i) => {
			const fix = vscode.CodeAction.create(
				`Change to: ${opt}`,
				{
					changes: doc.change({ replace: [{ range: wordRange, text: opt }] }),
				},
				vscode.CodeActionKind.QuickFix,
			)
			fix.diagnostics = [diagnostic]
			fix.isPreferred = i === 0
			return fix
		})
	},
}
const wrongImportSymbol: ActionDefinition = {
	code: ["2904"],
	kinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Empty],
	regex: () => new RegExp(/Declaration "(?<wrongSymbol>.*?)" not found in "(?<filePath>.*?)"/, "gm"),
	createFix: (doc, diagnostic) => {
		const match = wrongImportSymbol.regex().exec(diagnostic.message)

		if (!match?.groups?.wrongSymbol?.length) return null

		const wrongSymbol = match.groups.wrongSymbol

		const symbolRange = doc.getRangeInLine(diagnostic.range.start.line, wrongSymbol)
		const filePathRange = doc.getInLine(diagnostic.range.start.line, '"', '"')

		const fixes: vscode.CodeAction[] = []
		const items = []
		const map = new Map<string, string>()
		for (const cached of doc.walker.parsedDocumentsCache) {
			const docPath = cached.sourceDocument.absolutePath
			cached
				.getAllImportables()
				.filter((i) => i.name?.length && map.get(i.name) !== docPath)
				.forEach((i) => {
					map.set(i.name, docPath)
					items.push({ name: i.name, path: docPath })
				})
		}

		const fuse = new Fuse(items, {
			isCaseSensitive: true,
			threshold: 0.25,
			shouldSort: true,
			keys: ["name"],
			minMatchCharLength: 2,
			includeScore: true,
		})
		const characters = wrongSymbol.split("")
		const results = fuse
			.search(wrongSymbol)
			.sort((a, b) => {
				try {
					const itemA = a.item.name
					const itemB = b.item.name
					if (a.item.path === doc.path || b.item.path === doc.path) return -1

					if (a.score === 0) return -1
					if (b.score === 0) return 1
					const lenDiffA = Math.abs(itemA.length - wrongSymbol.length)
					const lenDiffB = Math.abs(itemB.length - wrongSymbol.length)

					if (lenDiffA < lenDiffB) return -1

					const isAlmostA = itemA.toLowerCase() === wrongSymbol.toLowerCase()
					const isAlmostB = itemB.toLowerCase() === wrongSymbol.toLowerCase()

					if (isAlmostA) a.score = 0.025
					if (isAlmostB) b.score = 0.025

					const isSameCasingA = characters.slice(0, itemA.length).every((c, i) => c === itemA[i])
					const isSameCasingB = characters.slice(0, itemB.length).every((c, i) => c === itemB[i])
					if (isSameCasingA && !isSameCasingB) a.score - 0.1 - b.score
					if (!isSameCasingA && isSameCasingB) return a.score + 0.1 - b.score
					return a.score - b.score
				} catch (e) {
					return 0
				}
			})
			.slice(0, 5)
			.map((r) => ({
				name: r.item.name,
				score: r.score,
				path: r.item.path,
				isSamePath: r.item.path === doc.path,
				imports: doc.walker.project.getPossibleImports(doc.path, r.item.path),
			}))
			.filter((r, i, self) => self.findIndex((s) => s.name === r.name && s.imports[0] === r.imports[0]) === i)
		try {
			fixes.push(
				...results
					.filter((r) => r.isSamePath)
					.map((r, i) => {
						const fix = vscode.CodeAction.create(`Change to: ${r.name}`, vscode.CodeActionKind.QuickFix)
						fix.diagnostics = [diagnostic]
						fix.edit = {
							changes: doc.change({ replace: [{ range: symbolRange, text: r.name }] }),
						}
						fix.isPreferred = i === 0
						return fix
					}),
			)
			fixes.push(
				...results
					.filter((r) => !r.isSamePath)
					.map((r) => {
						const fix = vscode.CodeAction.create(
							`Import ${r.name} from ${r.imports[0]}`,
							vscode.CodeActionKind.QuickFix,
						)
						fix.diagnostics = [diagnostic]
						fix.edit = {
							changes: doc.change({
								replace: [
									{ range: symbolRange, text: r.name },
									{ range: filePathRange, text: r.imports[0] },
								],
							}),
						}
						return fix
					})
					.filter(Boolean),
			)

			return fixes
		} catch (e) {
			console.debug("Error creating fix", e)
			return null
		}
	},
}
const unusedImport: ActionDefinition = {
	code: ["no-unused-import"],
	kinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Empty],
	regex: () => new RegExp(/imported name (?<name>.*?) is not used/, "gm"),
	createFix: (doc, diagnostic) => {
		const match = unusedImport.regex().exec(diagnostic.message)
		if (!match?.groups?.name) return null
		const name = match.groups.name

		const importItem = doc.getImports().find((i) => i.symbols.find((s) => s === name))

		if (importItem.symbols?.length === 1) {
			const fix = vscode.CodeAction.create("Remove import", vscode.CodeActionKind.QuickFix)
			fix.diagnostics = [diagnostic]
			fix.edit = {
				changes: doc.change({ del: [doc.lineRangeDel(importItem.line)] }),
			}
			fix.isPreferred = true
			return [fix]
		}
		const isFirst = importItem.symbols[0] === name

		const range = doc.getRangeInLine(importItem.line, isFirst ? `${name}, ` : `, ${name}`)

		const fix = vscode.CodeAction.create("Remove symbol", vscode.CodeActionKind.QuickFix)
		fix.diagnostics = [diagnostic]
		fix.edit = {
			changes: doc.change({ del: [range] }),
		}
		fix.isPreferred = true
		return [fix]
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
	if (!foundMatches?.length) return null
	const maxScore = Math.min(...foundMatches.map((m) => m.score))
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
				const maxScore = Math.min(...foundMatches.matches.map((m) => m.score))
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
	paths?: string[]
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
				const itemFound = document.getAllImportables().find((c) => c.name === symbol)

				if (!itemFound) return { found: false, result: null }

				if (results.find((i) => i.location === itemFound.document.sourceDocument.absolutePath))
					return { found: false, result: null }
				return {
					found: true,
					result: {
						import: undefined,
						location: itemFound.document.sourceDocument.absolutePath,
						paths: itemFound.document.sourceDocument.project.getPossibleImports(
							doc.folder,
							itemFound.document.sourceDocument.absolutePath,
						),
					},
				}
			})

			/* -------------------------------------------------------------------- */
			/*                               get local                              */
			/* -------------------------------------------------------------------- */

			const selectedDocumentImports = doc
				.getSelectedDocument()
				.imports.map((d, i) => ({
					import: d,
					isRelative: d.document.sourceDocument.isImportLocal(d.from),
					location: DocUtil.toPath(d.getReferenceLocation().uri),
					index: i,
				}))
				.filter((i) => imports.find((s) => s.location === i.location))

			/* -------------------------------------------------------------------- */
			/*                                create                                */
			/* -------------------------------------------------------------------- */

			const docImports = doc.getImports()
			/* ----------------------------- internals ---------------------------- */

			const internals = selectedDocumentImports.map((imp, i) => {
				const fix = vscode.CodeAction.create(`import from '${imp.import.from}'`, vscode.CodeActionKind.QuickFix)
				fix.diagnostics = [diagnostic]
				fix.edit = {
					changes: docImports[imp.index].addSymbol(symbol),
				}
				fix.isPreferred = i === 0
				return fix
			})
			/* ----------------------------- externals ---------------------------- */
			const externals = imports
				.flatMap((imp, i) => {
					if (!imp.paths) return []

					return imp.paths.map((fromPath, j) => {
						const fix = vscode.CodeAction.create(`import from '${fromPath}'`, vscode.CodeActionKind.QuickFix)
						fix.diagnostics = [diagnostic]
						fix.edit = {
							changes: docImports?.length
								? docImports[docImports.length - 1].addNewBelow(symbol, fromPath)
								: doc.addNewImport(symbol, fromPath),
						}
						fix.isPreferred = i === 0 && j === 0 && internals.length === 0
						return fix
					})
				})
				.filter((item, i, self) => self.findIndex((s) => s.title === item.title) === i)
				.slice(0, 5)

			/* ------------------------------ return ------------------------------ */

			const result = [...internals, ...externals.filter((e) => !internals.find((i) => i.title === e.title))].filter(
				Boolean,
			)

			if (result.length) {
				return result.concat(
					createFuzzyNameFix(doc, diagnostic, doc.wordRange(), getConfig().fuzzLevel.suggestionsWithImport, false),
				)
			}

			if (diagnostic.code !== "7576") {
				return createFuzzyNameFix(doc, diagnostic, doc.wordRange())
			}
		} catch (e: any) {
			// stack
			console.debug("Error creating fix", (e as Error).stack)
			console.debug("Create fix", e)
		}
	},
}

const actions = [importer, wrongImport, wrongImportSymbol, unusedImport, variableName, memberLookup] as const

export const getCodeActionFixes = (document: DocUtil, diagnostics: vscode.Diagnostic[]) => {
	return diagnostics
		.filter((diagnostic) =>
			actions.find((a) => {
				if (a.code.includes(String(diagnostic.code))) return true
			}),
		)
		.flatMap((diagnostic) => {
			return actions.flatMap((action) => {
				if (!action.code.includes(String(diagnostic.code))) return undefined
				return action.createFix(document, diagnostic)
			})
		})
		.filter(Boolean)
}
