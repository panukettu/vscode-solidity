import path from "node:path"
import { documents } from "@server"
import type { ParsedCode } from "@server/code/ParsedCode"
import type { ParsedDocument } from "@server/code/ParsedDocument"
import type { CodeWalkerService } from "@server/codewalker"
import { findByParam, getFunctionsByNameOffset } from "@server/providers/utils/functions"
import { isLeavingFunctionParams } from "@server/providers/utils/matchers"
import { funcDefMetadataRegexp, importFullRegexp, lineMetadataRegexp, nameRegexp } from "@shared/regexp"
import * as vscode from "vscode-languageserver/node"

type DocImport = {
	range: vscode.Range
	line: number
	lineText: string
	from: string
	symbols: string[]
	addSymbol: (symbol: string) => ReturnType<DocUtil["change"]>
	addNewBelow: (symbol: string, from: string) => ReturnType<DocUtil["change"]>
}

export class DocUtil {
	public lines: string[]
	public document: vscode.TextDocument
	public walker: CodeWalkerService
	public range: vscode.Range
	public position: vscode.Position
	public selection: vscode.SelectionRange
	public currentOffset: number
	public singleQuotes: boolean
	public spacesInSymbols: boolean
	public selections: readonly [ParsedCode, ParsedDocument, number]
	static positionRange(position: vscode.Position) {
		return vscode.Range.create(position, position)
	}
	constructor(document: vscode.TextDocumentIdentifier, range: vscode.Range, walker: CodeWalkerService) {
		this.document = documents.get(document.uri)
		if (!this.document) throw new Error(`Document not found: ${document.uri}`)
		const docText = this.document.getText()
		this.range = range
		this.position = range.start
		this.selection = vscode.SelectionRange.create(range)
		this.currentOffset = this.document.offsetAt(this.position)
		this.lines = docText.split(/\r?\n/g)
		this.walker = walker
		this.singleQuotes = docText.includes("from '")
		this.spacesInSymbols = docText.includes("import { ")
	}

	public getSelectedDocument() {
		return this.walker.getSelectedDocument(this.document, this.position)
	}
	public getSelected() {
		if (!this.selections?.length) {
			const selectedDocument = this.getSelectedDocument()
			const selectedItem = selectedDocument.getSelectedItem(this.currentOffset)
			this.selections = [selectedItem, selectedDocument, this.currentOffset] as const
		}
		return this.selections
	}

	public isCommentLine(line = this.position.line) {
		return (
			this.lineText(line).trim().startsWith("//") ||
			this.lineText(line).trim().startsWith("/*") ||
			this.lineText(line).trim().startsWith("*")
		)
	}

	public findCache<T>(fn: (document: ParsedDocument) => { found: boolean; result: T }): T | undefined {
		for (const document of this.walker.parsedDocumentsCache) {
			const outcome = fn(document)
			if (outcome.found) return outcome.result
		}
	}
	public filterMapCache<T>(
		fn: (document: ParsedDocument, results: T[]) => { found: boolean; result: T },
	): T[] | undefined {
		const results: T[] = []
		for (const document of this.walker.parsedDocumentsCache) {
			const outcome = fn(document, results)
			if (outcome.found) results.push(outcome.result)
		}
		return results
	}

	public change({
		replace,
		insert,
		del,
	}: {
		replace?: { range: vscode.Range; text: string }[]
		insert?: { position: vscode.Position; text: string }[]
		del?: vscode.Range[]
	}) {
		const inserts = insert ?? []
		const replaces = replace ?? []
		const deletes = del ?? []
		return {
			[this.document.uri]: [
				...replaces.map((c) => vscode.TextEdit.replace(c.range, c.text)),
				...inserts.map((c) => vscode.TextEdit.insert(c.position, c.text)),
				...deletes.map((c) => vscode.TextEdit.del(c)),
			],
		}
	}

	get uri() {
		return this.document.uri
	}
	get path() {
		return this.document.uri.replace("file://", "")
	}
	get folder() {
		return path.dirname(this.document.uri.replace("file://", ""))
	}
	static toPath(strWithFile: string) {
		return strWithFile.replace("file://", "")
	}

	public toText(range: vscode.Range, trim = false) {
		return !trim
			? this.document.getText(range)
			: this.document
					.getText(range)
					.split("\n")
					.map((s) => s.replace("\n", "").trim())
					.join("")
					.trim()
	}

	public getLineMeta() {
		const lineText = this.lineText()
		const word = this.getWord()
		const result = {
			isAssigning: false,
			isType: false,
			isVariable: false,
			isStorageLocation: false,
			isWrapper: (id: string) => lineText?.includes(`${id}(`) ?? false,
			ranges: {
				word: this.wordRange(),
				nextWord: this.getNextWord(),
				previousWord: this.getPreviousWord(),
			},
			text: {
				line: lineText,
				word,
				nextWord: this.toText(this.getNextWord()),
				previousWord: this.toText(this.getPreviousWord()),
			},
			type: undefined as string | undefined,
			storageLocation: undefined as string | undefined,
			variable: undefined as string | undefined,
			assignment: undefined as string | undefined,
			lineAfterPos: lineText.slice(this.position.character),
			isDotAccessBefore: lineText[this.position.character - 1] === ".",
			isEmit: lineText?.includes("emit") ?? false,
			isRevert: lineText?.includes("revert") ?? false,
			isDotAccessAfter: lineText[this.position.character + word.length] === ".",
		}
		let match = lineMetadataRegexp().exec(result.text.line)
		if (!match?.groups) {
			match = funcDefMetadataRegexp().exec(result.text.line)
			if (!match?.groups) {
				return result
			}
		}
		result.isAssigning = result.lineAfterPos?.includes("=") ?? false
		result.type = match.groups.type ? match.groups.type.trim() : undefined
		result.storageLocation = match.groups.location ? match.groups.location.trim() : undefined
		result.variable = match.groups.variable ? match.groups.variable.trim() : undefined
		result.assignment = match.groups.assignment ? match.groups.assignment.trim() : undefined

		const hasWord = result.text.word !== ""
		result.isType = hasWord && result.type && result.type.includes(result.text.word)
		result.isVariable = hasWord && result.text.word === result.variable
		result.isStorageLocation = hasWord && result.text.word === result.storageLocation
		return result
	}

	public getWord(position = this.position) {
		return this.document.getText(this.wordRange(position))
	}
	public getNextWord(position = this.position) {
		const line = this.lineText(position.line)
		const match = line.slice(position.character).match(/\W(\w+)/)
		if (!match) return vscode.Range.create(position.line, line.length, position.line, line.length)
		return this.wordRange(vscode.Position.create(position.line, match.index + position.character + 1))
	}

	public getPreviousWord(position = this.position) {
		const line = this.lineText(position.line)
		const word = this.wordRange()
		const lastIndex = word.start.character - 1
		const match = line.slice(0, lastIndex).match(/(\w+)\W*$/)
		if (!match) return vscode.Range.create(position.line, 0, position.line, 0)
		return this.wordRange(vscode.Position.create(position.line, match.index))
	}
	public lineText(line = this.position.line) {
		return this.document.getText(this.lineRange(line, false))
	}

	public getExpression() {
		const word = this.wordRange()
		const position = word.start
		const range = vscode.Range.create(position, this.findEndOf(this.position.line, this.position.line, "(", ")"))
		const text = this.toText(range, true)

		return {
			range,
			text,
			args: this.getExpressionArgs(text),
		}
	}

	private getExpressionArgs(text: string) {
		const argsText = text.slice(text.indexOf("(") + 1, text.lastIndexOf(")"))
		const args = argsText.split(",").map((s) => s.trim())

		const result: string[] = []
		let current = ""
		let depth = 0

		for (const arg of args) {
			const indexEnd = arg.indexOf(")")
			const matchIncrRegexp = /\(/g
			while ((matchIncrRegexp.exec(arg) || []).length > 0) {
				depth++
			}
			const matchDecrRegexp = /\)/g

			while ((matchDecrRegexp.exec(arg) || []).length > 0) {
				depth--
			}

			if (depth === 0 && arg.includes("(") && indexEnd !== -1 && arg.lastIndexOf(")") === indexEnd) {
				result.push(arg)
				continue
			}

			if (depth > 0) {
				current += `${arg},`
			} else if (!current && depth === 0) {
				result.push(arg)
			} else if (current && depth === 0) {
				current += arg
				result.push(current)
				current = ""
			}
		}
		return result
	}

	private findEndOf(startLine: number, currentLine: number, start: string, end: string): vscode.Position {
		const lineText = this.lineText(currentLine)
		const hasInner = startLine !== currentLine && lineText.includes(start)
		const terminator = lineText.lastIndexOf(end)
		if (terminator !== -1 && !hasInner) {
			return vscode.Position.create(currentLine, terminator + 1)
		}
		return this.findEndOf(startLine, currentLine + 1, start, end)
	}
	public lineTextNoWhitespace(line = this.position.line) {
		return this.document.getText(this.lineRange(line, true))
	}

	public getRange(str: string) {
		return this.getRangeInLine(this.getLineOf(str), str)
	}
	public getRangeBetween(from: string, to: string) {
		const line = this.getLineOf(from)
		return this.getInLine(line, from, to)
	}
	public getInLine(line: number, from: string, to: string) {
		const lineText = this.lineText(line)
		const start = lineText.indexOf(from)
		const end = lineText.lastIndexOf(to)
		return vscode.Range.create({ line, character: start + from.length }, { line, character: end })
	}

	public getLine(line: number) {
		return this.lines[line]
	}
	public lineRangeDel(line: number) {
		return vscode.Range.create({ character: 9999, line: line - 1 }, { character: 9999, line: line })
	}
	public getLines(range: vscode.Range) {
		const startLine = range.start.line
		const endLine = range.end.line
		return this.lines.slice(startLine, endLine + 1)
	}
	public getAllLines() {
		return this.lines
	}

	public getLineOf(str: string) {
		return this.lines.findIndex((l) => l.includes(str))
	}

	public lineHasText(line: string, range: vscode.Range, text: string) {
		return line.substring(range.start.character, range.end.character).includes(text)
	}

	public lineHasCurrentWord(line: string, range: vscode.Range) {
		return line.indexOf(this.toText(this.wordRange(range.start))) !== -1
	}

	public lineRange(line: number = this.position.line, ignoreWhitespace = true) {
		const lineText = this.lines[line]
		const startIndex = ignoreWhitespace ? lineText.match(/\S/)?.index ?? 0 : 0
		return vscode.Range.create(vscode.Position.create(line, startIndex), vscode.Position.create(line, lineText.length))
	}

	public getRangeInLine(line: number, str: string) {
		const start = this.lineText(line).indexOf(str)
		if (start === -1) return DocUtil.positionRange(this.position)

		return vscode.Range.create({ line, character: start }, { line, character: start + str.length })
	}
	public getWordAt(pos: number, text = this.document.getText()) {
		const left = text.slice(0, pos + 1).search(/\w+$/)
		const right = text.slice(pos).search(/\W/)
		return {
			start: left,
			end: right > -1 ? right + pos : text.length,
		}
	}

	public wordRange(position: vscode.Position = this.position) {
		const word = this.getWordAt(this.document.offsetAt(position))
		if (!word) return
		const start = this.document.positionAt(word.start)
		const end = this.document.positionAt(word.end)
		if (start.line === 0 && start.character === 0 && end.line !== 0) {
			return vscode.Range.create(end, end)
		}
		if (end.line === 0 && end.character === 0 && start.line !== 0) {
			return vscode.Range.create(start, start)
		}
		return vscode.Range.create(start, end)
	}

	public addNewImport(symbol: string, from: string) {
		const pragmaLine = this.getLineOf("pragma solidity")
		const importLine = this.getLineOf("import ")
		const targetLine = importLine > -1 ? importLine + 1 : pragmaLine > -1 ? pragmaLine + 1 : 0

		const symbolPart = this.spacesInSymbols ? ` { ${symbol} }` : `{${symbol}}`
		const fromPart = this.singleQuotes ? ` from '${from}'` : ` from "${from}"`
		const importText = `import ${symbolPart}${fromPart};\n`

		return this.change({
			insert: [{ position: vscode.Position.create(targetLine, 0), text: importText }],
		})
	}

	public getImports() {
		let match: RegExpExecArray | null
		const imports: DocImport[] = []
		while ((match = importFullRegexp.exec(this.document.getText())) !== null) {
			const symbolMatch = match.groups?.symbols ?? ""
			const fromMatch = match.groups?.from ?? ""

			const start = this.document.positionAt(match.index)
			const end = this.document.positionAt(match.index + match[0].length + 1)

			const item = {
				range: vscode.Range.create(start, end),
				line: start.line,
				lineText: this.getLine(start.line),
				from: fromMatch,
				symbols: (symbolMatch?.split(",").map((s) => s.trim()) ?? []) as string[],
				addSymbol: (symbol: string) => {
					try {
						if (!symbolMatch) return
						if (!item.symbols.includes(symbol)) {
							item.symbols.push(symbol)
							const newSymbols = item.symbols.sort((a, b) => a.localeCompare(b)).join(", ")
							const newLine = this.lineText(start.line).replace(symbolMatch, newSymbols)
							return this.change({ replace: [{ range: this.lineRange(start.line), text: newLine }] })
						}
					} catch (e) {
						console.debug("GetImports", e.message)
					}
				},
				addNewBelow: (symbol: string, from: string) => {
					const symbolPart = this.spacesInSymbols ? `{ ${symbol} }` : `{${symbol}}`
					const fromPart = this.singleQuotes ? ` from '${from}'` : ` from "${from}"`
					const hasContentBelow = this.lineText(start.line + 1).trim() !== ""
					const text = hasContentBelow ? `\nimport ${symbolPart}${fromPart};` : `\nimport ${symbolPart}${fromPart};`
					return this.change({ insert: [{ position: end, text }] })
				},
			}
			imports.push(item)
		}
		return imports
	}

	public getFunction() {
		const line = this.lineText()
		const functionNames = line.match(nameRegexp)

		if (!functionNames?.length || isLeavingFunctionParams(line, this.position.character)) return null
		const index =
			line.slice(line.indexOf(functionNames[functionNames.length - 1]), this.position.character).split(",").length - 1
		const functionsFound = getFunctionsByNameOffset(functionNames, this)

		return findByParam(functionsFound, index, undefined)
	}
}
