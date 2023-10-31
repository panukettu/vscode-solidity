import { Location, Range } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { TypeReference } from '../search/TypeReference';
import { ParsedCode } from './ParsedCode';
import { ParsedDocument } from './ParsedDocument';

export class ParsedImport extends ParsedCode {
	public from: string;
	public documentReference: ParsedDocument = null;
	public symbols: { name: string; alias: string }[] = [];

	public override getInfo(): string {
		return this.createInfo(
			'',
			'',
			`${this.symbols.length > 0 ? this.symbols.length : ''} from ${this.from}`,
			undefined,
			true,
			false
		);
	}

	public getParsedObjectType(): string {
		return 'import';
	}

	public initialise(element: any, document: ParsedDocument) {
		this.document = document;
		this.element = element;
		this.from = element.from;
		this.symbols = element.symbols;
	}

	public override getSelectedTypeReferenceLocation(offset: number): TypeReference[] {
		if (this.isCurrentElementedSelected(offset)) {
			return [TypeReference.create(true, this.getReferenceLocation())];
		}
		return [TypeReference.create(false)];
	}

	public initialiseDocumentReference(parsedDocuments: ParsedDocument[]) {
		for (let index = 0; index < parsedDocuments.length; index++) {
			const element = parsedDocuments[index];
			if (element.sourceDocument.absolutePath === this.document.sourceDocument.resolveImportPath(this.from)) {
				this.documentReference = element;
				if (this.document.importedDocuments.indexOf(element) === -1) {
					this.document.addImportedDocument(element);
				}
			}
		}
	}

	public getDocumentsThatReference(document: ParsedDocument): ParsedDocument[] {
		if (this.documentReference) {
			return this.documentReference.getDocumentsThatReference(document);
		}
		return [];
	}

	public getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): TypeReference[] {
		if (this.isCurrentElementedSelected(offset)) {
			return this.getAllReferencesToObject(this.documentReference);
		}
		return [];
	}

	public getReferenceLocation(): Location {
		const path = this.document.sourceDocument.resolveImportPath(this.from);
		// note: we can use the path to find the referenced source document too.
		return Location.create(URI.file(path).toString(), Range.create(0, 0, 0, 0));
	}
}
