import { Location, Range } from "vscode-languageserver";
import { FindTypeReferenceLocationResult, ParsedCode } from "./parsedCode";
import { ParsedDocument } from "./ParsedDocument";
import { URI } from "vscode-uri";

export class ParsedImport extends ParsedCode {
  public from: string;
  public documentReference: ParsedDocument = null;
  public symbols: { name: string; alias: string }[] = [];

  public override getInfo(): string {
    return this.createSimpleDetail(
      "",
      "",
      `${this.symbols.length > 0 ? this.symbols.length : ""} from ${this.from}`,
      undefined,
      true,
      false
    );
  }

  public getParsedObjectType(): string {
    return "import";
  }

  public initialise(element: any, document: ParsedDocument) {
    this.document = document;
    this.element = element;
    this.from = element.from;
    this.symbols = element.symbols;
  }

  public override getSelectedTypeReferenceLocation(
    offset: number
  ): FindTypeReferenceLocationResult[] {
    if (this.isCurrentElementedSelected(offset)) {
      return [
        FindTypeReferenceLocationResult.create(
          true,
          this.getReferenceLocation()
        ),
      ];
    }
    return [FindTypeReferenceLocationResult.create(false)];
  }

  public initialiseDocumentReference(parsedDocuments: ParsedDocument[]) {
    for (let index = 0; index < parsedDocuments.length; index++) {
      const element = parsedDocuments[index];
      if (
        element.sourceDocument.absolutePath ===
        this.document.sourceDocument.resolveImportPath(this.from)
      ) {
        this.documentReference = element;
        if (this.document.importedDocuments.indexOf(element) < 0) {
          this.document.addImportedDocument(element);
        }
      }
    }
  }

  public getDocumentsThatReference(document: ParsedDocument): ParsedDocument[] {
    if (this.documentReference !== null) {
      return this.documentReference.getDocumentsThatReference(document);
    }
    return [];
  }

  public getAllReferencesToSelected(
    offset: number,
    documents: ParsedDocument[]
  ): FindTypeReferenceLocationResult[] {
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
