import { documents } from "@server"
import { ParsedDocument } from "@server/code/ParsedDocument"
import { CodeWalkerService } from "@server/codewalker"
import { funcDefMetadataRegexp, importFullRegexp, lineMetadataRegexp } from "@shared/regexp"
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
	public currentOffset: number
	public solFiles: string[]
	constructor(document: vscode.TextDocumentIdentifier, range: vscode.Range, walker: CodeWalkerService) {
		this.document = documents.get(document.uri)
		if (!this.document) throw new Error(`Document not found: ${document.uri}`)

		this.range = range
		this.position = range.start
		this.selection = vscode.SelectionRange.create(range)
		this.currentOffset = this.document.offsetAt(this.position)
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

	public toText(range: vscode.Range) {
		return this.document.getText(range)
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
		const lastIndex = position.character - 1
		const match = line.slice(0, lastIndex).match(/(\w+)\W*$/)
		if (!match) return vscode.Range.create(position.line, 0, position.line, 0)
		return this.wordRange(vscode.Position.create(position.line, match.index))
	}
	public lineText(line = this.position.line) {
		return this.document.getText(this.lineRange(line, false))
	}
	public lineTextNoWhitespace(line = this.position.line) {
		return this.document.getText(this.lineRange(line, true))
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
		return line.indexOf(this.toText(this.wordRange(range.start))) !== -1
	}

	public lineRange(line: number, ignoreWhitespace = true) {
		const lineText = this.lines[line]
		const startIndex = ignoreWhitespace ? lineText.match(/\S/)?.index ?? 0 : 0
		return vscode.Range.create(vscode.Position.create(line, startIndex), vscode.Position.create(line, lineText.length))
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
		} else if (end.line === 0 && end.character === 0 && start.line !== 0) {
			return vscode.Range.create(start, start)
		}
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
						console.error(e)
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
