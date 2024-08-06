import path from "node:path"
import { Location, Range } from "vscode-languageserver"
import { URI } from "vscode-uri"
import { TypeReference } from "../search/TypeReference"
import { ParsedCode } from "./ParsedCode"
import type { ParsedDocument } from "./ParsedDocument"
import type { ImportElement } from "./types"

export class ParsedImport extends ParsedCode {
	public from: string
	public documentReference: ParsedDocument = null
	public symbols: ImportElement["symbols"] = []
	public isFullAs = false

	public override getInfo(): string {
		return this.createInfo(
			"",
			"",
			`${this.symbols.length > 0 ? this.symbols.length : ""} from ${this.from}`,
			undefined,
			true,
			false,
		)
	}

	public getParsedObjectType(): string {
		return "import"
	}

	public initialise(element: ImportElement, document: ParsedDocument) {
		this.document = document
		this.element = element
		this.from = element.from
		this.symbols = element.symbols
		this.name = (<string>element.from)?.split("/").pop()

		if (!this.symbols.length) {
			const symbols = this.document.sourceDocument.imports.find((x) => x.importPath === this.from)?.symbols
			if (!symbols?.length) return
			this.symbols = symbols.map((s) => {
				const start = this.document.sourceDocument.unformattedCode.indexOf(s)
				return { type: "Symbol", name: s, alias: s, start: start, end: start + s.length }
			})

			this.isFullAs = true
		}
	}

	public override getSelectedTypeReferenceLocation(offset: number): TypeReference[] {
		if (this.isCurrentElementedSelected(offset)) {
			return [TypeReference.create(true, this.getReferenceLocation())]
		}
		return [TypeReference.create(false)]
	}

	public initialiseDocumentReference(parsedDocuments: ParsedDocument[]) {
		for (let index = 0; index < parsedDocuments.length; index++) {
			const element = parsedDocuments[index]
			if (element.sourceDocument.absolutePath === this.document.sourceDocument.resolveImportPath(this.from)) {
				this.documentReference = element
				if (this.document.importedDocuments.indexOf(element) === -1) {
					this.document.addImportedDocument(element)
				}
			}
		}
	}

	public getDocumentsThatReference(document: ParsedDocument): ParsedDocument[] {
		if (this.documentReference) {
			return this.documentReference.getDocumentsThatReference(document)
		}
		return []
	}

	public getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): TypeReference[] {
		if (this.isCurrentElementedSelected(offset)) {
			return this.getAllReferencesToObject(this.documentReference)
		}
		return []
	}

	public getRelativePath(from: string): string {
		if (!this.document?.sourceDocument) return ""
		const result = this.document.sourceDocument.resolveImportPath(this.from)
		if (result.startsWith(".")) return result
		return `./${result}`
	}

	public getReferenceLocation(): Location {
		if (!this.document) return null
		const path = this.document.sourceDocument.resolveImportPath(this.from)
		// note: we can use the path to find the referenced source document too.
		return Location.create(URI.file(path).toString(), Range.create(0, 0, 0, 0))
	}
}
