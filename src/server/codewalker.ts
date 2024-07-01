import * as vscode from "vscode-languageserver"
import { URI } from "vscode-uri"

import * as fs from "fs"
import * as solparse from "@pkxp/solparse-exp-jb"
import { documentMap } from "@server/providers/utils/caches"
import { Project } from "@shared/project/project"
import { SourceDocument } from "@shared/project/sourceDocument"
import { SourceDocumentCollection, mockConsoleSol } from "@shared/project/sourceDocuments"
import { SolidityConfig } from "@shared/types"
import { ParsedDocument } from "./code/ParsedDocument"

export class CodeWalkerService {
	public initialized: boolean
	public project: Project
	public rootPath: string
	public config: SolidityConfig
	public parsedDocumentsCache: ParsedDocument[] = []

	constructor(rootPath: string, config: SolidityConfig) {
		this.rootPath = rootPath
		this.config = config
		if (this.rootPath != null) {
			this.project = new Project(this.config, this.rootPath)
			this.config = this.project.cfg
		}
		this.initDocuments()
	}

	public initDocuments() {
		if (!this.project) throw new Error("Project not initialized")
		const sourceDocuments = new SourceDocumentCollection()
		for (const path of this.project.getProjectSolFiles() ?? []) {
			const existing = sourceDocuments.documents.find((d) => d.absolutePath === path)

			if (!existing) {
				const item = sourceDocuments.addSourceDocumentAndResolveImports(
					path,
					fs.readFileSync(path, "utf8"),
					this.project,
				)

				this.parseDocumentAsync(item.unformattedCode, false, item)
			} else {
				this.parseDocumentAsync(existing.unformattedCode, false, existing)
			}
		}
		for (const path of this.project.getLibSourceFiles()) {
			const existing = sourceDocuments.documents.find((d) => d.absolutePath === path)
			if (existing) this.parseDocumentAsync(existing.unformattedCode, false, existing)
		}
		queueMicrotask(() => {
			this.parsedDocumentsCache.forEach((element) => {
				element.initialiseDocumentReferences(this.parsedDocumentsCache)
			})
			this.initialized = true
		})
	}

	public initialiseChangedDocuments() {
		const sourceDocuments = new SourceDocumentCollection()
		this.project.getProjectSolFiles().forEach((contractPath) => {
			if (!sourceDocuments.containsSourceDocument(contractPath)) {
				sourceDocuments.addSourceDocumentAndResolveImports(
					contractPath,
					fs.readFileSync(contractPath, "utf8"),
					this.project,
				)
			}
		})
		sourceDocuments.documents.forEach((sourceDocumentItem) => {
			this.parseDocumentChanged(sourceDocumentItem.unformattedCode, false, sourceDocumentItem)
		})
	}

	public getSelectedDocumentProfiler(document: vscode.TextDocument, position: vscode.Position): ParsedDocument {
		return this.getSelectedDocument(document, position)
	}
	public getSelectedDocument(document: vscode.TextDocument, position: vscode.Position): ParsedDocument {
		let selectedDocument: ParsedDocument
		let selectedSourceDocument: SourceDocument
		if (this.project == null) return selectedDocument

		const offset = document.offsetAt(position)
		const documentText = document.getText()

		const cached = this.parsedDocumentsCache.find((x) => {
			return `file://${x?.sourceDocument.absolutePath}` === document.uri
		})

		if ((cached && documentText === cached.sourceDocument?.unformattedCode) || cached?.fixedSource) {
			selectedDocument = cached
			selectedDocument.initCache(offset)
			selectedDocument.initialiseDocumentReferences(this.parsedDocumentsCache)
		} else {
			const sourceDocuments = new SourceDocumentCollection()
			sourceDocuments.addSourceDocumentAndResolveImports(URI.parse(document.uri).fsPath, documentText, this.project)

			selectedSourceDocument = sourceDocuments.documents[0]

			selectedDocument = this.parseSelectedDocument(documentText, offset, position.line, false, selectedSourceDocument)
			selectedDocument.initialiseDocumentReferences(this.parsedDocumentsCache)
		}
		return selectedDocument
	}

	public parseSelectedDocument(
		documentText: string,
		offset: number,
		line: number,
		fixedSource: boolean,
		sourceDocument: SourceDocument,
	): ParsedDocument {
		const newDocument: ParsedDocument = new ParsedDocument()

		try {
			const result = solparse.parse(documentText)
			const selectedElement = this.findElementByOffset(result.body, offset)
			newDocument.initialiseDocument(result, selectedElement, sourceDocument, fixedSource ? documentText : null)
			this.updateCache(newDocument, sourceDocument)
		} catch (error) {
			const lines = documentText.split(/\r?\n/g)
			if (lines[line].trim() !== "") {
				lines[line] = "".padStart(lines[line].length, " ")
				const code = lines.join("\r\n")
				return this.parseSelectedDocument(code, offset, line, false, sourceDocument)
			}
		}

		return newDocument
	}

	public updateCache(newDocument: ParsedDocument, sourceDocument: SourceDocument) {
		documentMap.clear()
		const foundDocument = this.parsedDocumentsCache.find(
			(x) => x.sourceDocument.absolutePath === sourceDocument.absolutePath,
		)
		if (!foundDocument) {
			this.parsedDocumentsCache.push(newDocument)

			this.parsedDocumentsCache.forEach((element) => {
				element.initialiseDocumentReferences(this.parsedDocumentsCache)
			})
			return
		}

		if (foundDocument.fixedSource || foundDocument.sourceDocument.unformattedCode === sourceDocument.unformattedCode)
			return

		this.parsedDocumentsCache = this.parsedDocumentsCache.filter((x) => x !== foundDocument)
		const affectedDocuments = this.parsedDocumentsCache.filter((x) => x.importedDocuments.includes(foundDocument))

		this.parsedDocumentsCache.push(newDocument)

		newDocument.initialiseDocumentReferences(this.parsedDocumentsCache)

		affectedDocuments.concat(newDocument.importedDocuments).forEach((ref) => {
			ref.initialiseDocumentReferences(this.parsedDocumentsCache)
		})
	}

	public parseDocumentChanged(
		documentText: string,
		fixedSource: boolean,
		sourceDocument: SourceDocument,
	): ParsedDocument {
		const foundDocument = this.parsedDocumentsCache.find(
			(x) => x.sourceDocument.absolutePath === sourceDocument.absolutePath,
		)
		if (foundDocument != null) {
			if (foundDocument.sourceDocument.unformattedCode === sourceDocument.unformattedCode) {
				return foundDocument
			}
		}

		const newDocument: ParsedDocument = new ParsedDocument()
		try {
			const result = solparse.parse(documentText)
			newDocument.initialiseDocument(result, null, sourceDocument, fixedSource ? documentText : null)

			this.updateCache(newDocument, sourceDocument)
		} catch (error) {
			console.debug("parsedDocumentChange", error.message)
			/*
        // if we error parsing (cannot cater for all combos) we fix by removing current line.
        const lines = documentText.split(/\r?\n/g);
        if (lines[line].trim() !== '') { // have we done it already?
            lines[line] = ''.padStart(lines[line].length, ' '); // adding the same number of characters so the position matches where we are at the moment
            const code = lines.join('\r\n');
            return this.parseDocument(code, true, sourceDocument);
        }*/
		}
		return newDocument
	}

	public parseDocumentAsync(documentText: string, fixedSource: boolean, sourceDocument: SourceDocument): void {
		queueMicrotask(() => this.parseDocument(documentText, fixedSource, sourceDocument))
	}
	public parseDocument(documentText: string, fixedSource: boolean, sourceDocument: SourceDocument): ParsedDocument {
		const foundDocument = this.parsedDocumentsCache.find(
			(x) => x.sourceDocument.absolutePath === sourceDocument.absolutePath,
		)
		const newDocument = new ParsedDocument()
		if (foundDocument != null) {
			if (foundDocument.sourceDocument.unformattedCode !== sourceDocument.unformattedCode) {
				newDocument.initialiseDocument(foundDocument.element, null, sourceDocument, foundDocument?.fixedSource)

				this.parsedDocumentsCache = this.parsedDocumentsCache.filter((x) => x !== foundDocument)
				this.parsedDocumentsCache.push(newDocument)
				return newDocument
			} else {
				return foundDocument
			}
		}
		try {
			const text = sourceDocument.absolutePath.includes("onsole") ? mockConsoleSol : documentText
			const result = solparse.parse(text)

			newDocument.initialiseDocument(result, null, sourceDocument, fixedSource ? text : null)

			this.parsedDocumentsCache.push(newDocument)
		} catch (error) {
			console.debug("Unhandled (parse)", error, sourceDocument.absolutePath)
			// console.log(JSON.stringify(error));
			/*
            // if we error parsing (cannot cater for all combos) we fix by removing current line.
            const lines = documentText.split(/\r?\n/g);
            if (lines[line].trim() !== '') { // have we done it already?
                lines[line] = ''.padStart(lines[line].length, ' '); // adding the same number of characters so the position matches where we are at the moment
                const code = lines.join('\r\n');
                return this.parseDocument(code, true, sourceDocument);
            }*/
		}
		return newDocument
	}

	// public getContracts(documentText: string, document: ParsedDocument): ParsedContract[] {
	// 	const contracts: ParsedContract[] = []
	// 	try {
	// 		const result: Element = solparse.parse(documentText)

	// 		result.body.forEach((element) => {
	// 			if (
	// 				element.type === "ContractStatement" ||
	// 				element.type === "LibraryStatement" ||
	// 				element.type === "InterfaceStatement"
	// 			) {
	// 				const contract = new ParsedContract()
	// 				contract.initialise(element, document)
	// 				contracts.push(contract)
	// 			}
	// 		})
	// 	} catch (error) {
	// 		console.debug("GetContracts:", error.message)
	// 	}
	// 	return contracts
	// }

	private findElementByOffset(elements: Array<{ start: number; end: number }>, offset: number): any {
		return elements.find((element) => element.start <= offset && offset <= element.end)
	}
}
