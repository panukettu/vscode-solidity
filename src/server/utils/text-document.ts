import { documents } from "@server"
import { ParsedDocument } from "@server/code/ParsedDocument"
import { CodeWalkerService } from "@server/codewalker"
import { importFullRegexp } from "@shared/regexp"
import * as vscode from "vscode-languageserver/node"

// const containsText = (line: string, range: vscode.Range, text: string) => {
// return line.substring(range.start.character, range.end.character).includes(text)
// }
// const containsRange = (line: string, range: vscode.Range) => {
// return line.substring(range.start.character, range.end.character) !== ""
// }
// const getLine = (document: vscode.TextDocument, line: number) => {
// const lines = document.getText().split(/\r?\n/g)
// return lines[line]
// }

// const getAllLines = (document: vscode.TextDocument, range: vscode.Range) => {
// return document.getText().split(/\r?\n/g)
// }
// const getLines = (document: vscode.TextDocument, range: vscode.Range) => {
// const lines = document.getText().split(/\r?\n/g)
// const startLine = range.start.line
// const endLine = range.end.line
// return lines.slice(startLine, endLine + 1)
// }

// const lineRange = (document: vscode.TextDocument, line: number) => {
// const lines = document.getText().split(/\r?\n/g)
// const lineText = lines[line]
// const firstNonWhitespaceCharacterIndex = lineText.match(/\S/)?.index
// return vscode.Range.create(
// vscode.Position.create(line, firstNonWhitespaceCharacterIndex),
// vscode.Position.create(line, lineText.length),
// )
// }
// const getWordAt = (text: string, pos: number) => {
// const left = text.slice(0, pos + 1).search(/\S+$/)
// const right = text.slice(pos).search(/\s/)
// return {
// start: left,
// end: right > -1 ? right + pos : text.length,
// }
// }
// const wordRange = (document: vscode.TextDocument, position: vscode.Position) => {
// const text = document.getText()
// const word = getWordAt(text, document.offsetAt(position))
// if (!word) return
// const start = document.positionAt(word.start)
// const end = document.positionAt(word.end)
// return vscode.Range.create(start, end)
// }

type DocImport = {
	range: vscode.Range
	line: string
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
	public solFiles: string[]
	constructor(document: vscode.TextDocumentIdentifier, range: vscode.Range, walker: CodeWalkerService) {
		this.document = documents.get(document.uri)
		if (!this.document) throw new Error(`Document not found: ${document.uri}`)

		this.range = range
		this.position = range.start
		this.selection = vscode.SelectionRange.create(range)
		this.lines = this.document.getText().split(/\r?\n/g)
		this.walker = walker
		this.solFiles = this.walker.project.getProjectSolFiles().concat(this.walker.project.getLibSourceFiles())
	}

	public getSelectedDocument() {
		return this.walker.getSelectedDocument(this.document, this.position)
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
	}: { replace?: { range: vscode.Range; text: string }[]; insert?: { position: vscode.Position; text: string }[] }) {
		const insertChanges = insert?.length ? insert : []
		const replaceChanges = replace?.length ? replace : []
		return {
			[this.document.uri]: [
				...replaceChanges.map((c) => vscode.TextEdit.replace(c.range, c.text)),
				...insertChanges.map((c) => vscode.TextEdit.insert(c.position, c.text)),
			],
		}
	}

	get uri() {
		return this.document.uri
	}
	get path() {
		return this.document.uri.replace("file://", "")
	}
	static toPath(strWithFile: string) {
		return strWithFile.replace("file://", "")
	}

	public rangeText(range: vscode.Range) {
		return this.document.getText(range)
	}

	public getWord(position = this.position) {
		return this.document.getText(this.wordRange(position))
	}
	public getNextWord() {
		const word = this.getWord()
		const line = this.lineText(this.position.line, false)
		const index = line.indexOf(word) + word.length + 1
		const start = vscode.Position.create(this.position.line, index)
		return this.wordRange(start)
	}
	public lineText(line = this.position.line, ws = true) {
		return this.document.getText(this.lineRange(line, ws))
	}

	public getLine(line: number) {
		return this.lines[line]
	}
	public getLines(range: vscode.Range) {
		const startLine = range.start.line
		const endLine = range.end.line
		return this.lines.slice(startLine, endLine + 1)
	}
	public getAllLines() {
		return this.lines
	}

	public lineHasText(line: string, range: vscode.Range, text: string) {
		return line.substring(range.start.character, range.end.character).includes(text)
	}

	public lineHasCurrentWord(line: string, range: vscode.Range) {
		return line.indexOf(this.rangeText(this.wordRange(range.start))) !== -1
	}

	public lineRange(line: number, ws = true) {
		const lineText = this.lines[line]
		const startIndex = ws ? lineText.match(/\S/)?.index ?? 0 : 0
		return vscode.Range.create(vscode.Position.create(line, startIndex), vscode.Position.create(line, lineText.length))
	}
	public getWordAt(text: string, pos: number) {
		const left = text.slice(0, pos + 1).search(/\w+$/)
		const right = text.slice(pos).search(/\W/)
		return {
			start: left,
			end: right > -1 ? right + pos : text.length,
		}
	}

	public wordRange(position: vscode.Position) {
		const text = this.document.getText()
		const word = this.getWordAt(text, this.document.offsetAt(position))
		if (!word) return
		const start = this.document.positionAt(word.start)
		const end = this.document.positionAt(word.end)
		return vscode.Range.create(start, end)
	}

	public getImports() {
		let match: RegExpExecArray | null
		const imports: DocImport[] = []
		while ((match = importFullRegexp.exec(this.document.getText())) !== null) {
			const symbolMatch = match.groups?.symbols ?? ""
			const fromMatch = match.groups?.from ?? ""

			const start = this.document.positionAt(match.index)
			const end = this.document.positionAt(match.index + match[0].length + 1)
			const usesDoubleQuotes = match[0].includes('"')
			const usesSpacesInSymbols = match[0].includes("{ ")

			imports.push({
				range: vscode.Range.create(start, end),
				line: this.getLine(start.line),
				from: fromMatch,
				symbols: symbolMatch?.split(",").map((s) => s.trim()) ?? [],
				addSymbol: (symbol: string) => {
					try {
						if (!symbolMatch) return
						const symbols = symbolMatch.split(",").map((s) => s.trim())
						if (!symbols.includes(symbol)) {
							symbols.push(symbol)
							const newSymbols = symbols.sort((a, b) => a.localeCompare(b)).join(", ")
							const newLine = this.lineText(start.line).replace(symbolMatch, newSymbols)
							return this.change({ replace: [{ range: this.lineRange(start.line), text: newLine }] })
						}
					} catch (e) {
						console.debug(e)
					}
				},
				addNewBelow: (symbol: string, from: string) => {
					let fromPart = ""
					let symbolPart = symbol
					if (usesSpacesInSymbols) {
						symbolPart = ` { ${symbolPart} }`
					} else {
						symbolPart = `{${symbolPart}}`
					}
					if (usesDoubleQuotes) {
						fromPart = ` from "${from}"`
					} else {
						fromPart = ` from '${from}'`
					}
					const hasContentBelow = this.lineText(start.line + 1).trim() !== ""
					const text = hasContentBelow ? `\nimport ${symbolPart}${fromPart};` : `\nimport ${symbolPart}${fromPart};`
					return this.change({ insert: [{ position: end, text }] })
				},
			})
		}
		return imports
	}
}
