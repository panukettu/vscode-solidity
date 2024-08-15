import { importCache } from "@shared/project/cache"
import { createDetails } from "@shared/util"
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
		const doc = this.documentReference
		const details = createDetails(
			{
				num: doc.innerContracts.length,
				str: "contracts",
			},
			{
				num: doc.functions.length,
				str: "free-funcs",
			},
			{
				num: doc.structs.length,
				str: "structs",
			},
			{
				num: doc.constants.length,
				str: "consts",
			},
			{
				num: doc.enums.length,
				str: "enums",
			},
			{
				num: doc.events.length,
				str: "events",
			},
			{
				num: doc.errors.length,
				str: "errors",
			},
			{
				num: doc.customTypes.length,
				str: "user-types",
			},
		)

		const allImports = doc
			.getAllImportables()
			.map((x, i, self) => {
				if (i % 2 === 0) return `${x.name}${self[i + 1] ? `, ${self[i + 1].name}` : ""}`
			})
			.filter(Boolean)
			.join("\n")
		return this.createInfo(
			"",
			"",
			`${this.symbols.length ?? ""} from ${this.from}\nexports\n${details}\n${allImports}`,
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
		const pathToThis = this.document.sourceDocument.resolveImportPath(this.from)
		const found = parsedDocuments.find((x) => x.sourceDocument.absolutePath === pathToThis)
		if (found) {
			this.documentReference = found
			this.document.addImportedDocument(this.documentReference)
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
		const pathToThis = this.document.sourceDocument.resolveImportPath(this.from)
		if (pathToThis.startsWith(".")) return pathToThis
		return `./${pathToThis}`
	}

	public getReferenceLocation(): Location {
		if (!this.document) return null
		const path = this.document.sourceDocument.resolveImportPath(this.from)
		// note: we can use the path to find the referenced source document too.
		return Location.create(URI.file(path).toString(), Range.create(0, 0, 0, 0))
	}

	public getImportedSymbols(): ParsedCode[] {
		return importCache.visit(this)
	}
}
