import * as vscode from "vscode-languageserver";
import { URI } from "vscode-uri";

import { SourceDocumentCollection } from "../../common/model/sourceDocumentCollection";
import { Project } from "../../common/model/project";
import { initialiseProject } from "../../common/projectService";
import * as solparse from "solparse-exp-jb";
import { ParsedContract } from "./parsedContract";
import { ParsedDocument } from "./ParsedDocument";
import { SourceDocument } from "../../common/model/sourceDocument";
import * as fs from "fs";
import { SoliditySettings } from "../../server";
import { Element } from "./Types";

export class CodeWalkerService {
  public initialized: boolean;
  public project: Project;
  public rootPath: string;
  public settings: SoliditySettings;
  public resolvedSources: string;
  public parsedDocumentsCache: ParsedDocument[] = [];

  constructor(rootPath: string, settings: SoliditySettings) {
    this.rootPath = rootPath;
    this.settings = settings;

    if (this.rootPath != null) {
      const { project, sources } = initialiseProject(
        this.rootPath,
        this.settings
      );
      this.project = project;
      this.resolvedSources = sources;
    }
    this.initDocuments(this.settings.initExclude);
  }

  public initDocuments(initExclude: string[]) {
    const sourceDocuments = new SourceDocumentCollection();
    const files = this.project.getProjectSolFiles(initExclude);
    for (const path of files) {
      const existing = sourceDocuments.documents.find(
        (d) => d.absolutePath === path
      );
      if (!existing) {
        const item = sourceDocuments.addSourceDocumentAndResolveImports(
          path,
          fs.readFileSync(path, "utf8"),
          this.project
        );
        this.parseDocument(item.unformattedCode, false, item);
      } else {
        this.parseDocument(existing.unformattedCode, false, existing);
      }
    }

    this.initialized = true;

    this.parsedDocumentsCache.forEach((element) => {
      element.imports.forEach((importItem) => {
        importItem.initialiseDocumentReference(this.parsedDocumentsCache);
      });
    });
  }

  public initialiseChangedDocuments() {
    const sourceDocuments = new SourceDocumentCollection();
    this.project.getProjectSolFiles().forEach((contractPath) => {
      if (!sourceDocuments.containsSourceDocument(contractPath)) {
        sourceDocuments.addSourceDocumentAndResolveImports(
          contractPath,
          fs.readFileSync(contractPath, "utf8"),
          this.project
        );
      }
    });
    sourceDocuments.documents.forEach((sourceDocumentItem) => {
      this.parseDocumentChanged(
        sourceDocumentItem.unformattedCode,
        false,
        sourceDocumentItem
      );
    });
  }

  public getSelectedDocument(
    document: vscode.TextDocument,
    position: vscode.Position
  ): ParsedDocument {
    let selectedDocument: ParsedDocument = new ParsedDocument();
    const documentText = document.getText();
    const sourceDocuments = new SourceDocumentCollection();

    if (this.project != null) {
      sourceDocuments.addSourceDocumentAndResolveImports(
        URI.parse(document.uri).fsPath,
        documentText,
        this.project
      );
    }

    const selectedSourceDocument = sourceDocuments.documents[0];
    const offset = document.offsetAt(position);

    selectedDocument = this.parseSelectedDocument(
      documentText,
      offset,
      position.line,
      false,
      selectedSourceDocument
    );
    // sourceDocuments.documents.forEach((sourceDocumentItem) => {
    //   if (sourceDocumentItem !== selectedSourceDocument) {
    //     const documentImport = this.parseDocumentChanged(
    //       sourceDocumentItem.code,
    //       false,
    //       sourceDocumentItem
    //     );
    //     selectedDocument.addImportedDocument(documentImport);
    //   }
    // });
    // this.parsedDocumentsCache.forEach((element) => {
    //   console.debug("cache init refs");
    //   element.initialiseDocumentReferences(this.parsedDocumentsCache);
    // });
    selectedDocument.initialiseDocumentReferences(this.parsedDocumentsCache);

    return selectedDocument;
  }

  public parseSelectedDocument(
    documentText: string,
    offset: number,
    line: number,
    fixedSource: boolean,
    sourceDocument: SourceDocument
  ): ParsedDocument {
    const foundDocument = this.parsedDocumentsCache.find(
      (x) => x.sourceDocument.absolutePath === sourceDocument.absolutePath
    );
    const newDocument: ParsedDocument = new ParsedDocument();
    if (foundDocument != null) {
      if (
        !fixedSource &&
        foundDocument.sourceDocument.code === sourceDocument.code
      ) {
        const selectedElement = this.findElementByOffset(
          foundDocument.element.body,
          offset
        );
        newDocument.initialiseDocument(
          foundDocument.element,
          selectedElement,
          foundDocument.sourceDocument,
          foundDocument.fixedSource
        );
        this.parsedDocumentsCache.push(newDocument);
        this.parsedDocumentsCache = this.parsedDocumentsCache.filter(
          (x) => x !== foundDocument
        );
        return foundDocument;
      }
      this.parsedDocumentsCache = this.parsedDocumentsCache.filter(
        (x) => x !== foundDocument
      );
    }
    try {
      const result = solparse.parse(documentText);
      const selectedElement = this.findElementByOffset(result.body, offset);
      if (fixedSource) {
        newDocument.initialiseDocument(
          result,
          selectedElement,
          sourceDocument,
          documentText
        );
      } else {
        newDocument.initialiseDocument(
          result,
          selectedElement,
          sourceDocument,
          null
        );
      }
      this.parsedDocumentsCache.push(newDocument);
    } catch (error) {
      const lines = documentText.split(/\r?\n/g);
      if (lines[line].trim() !== "") {
        // have we done it already?
        lines[line] = "".padStart(lines[line].length, " "); // adding the same number of characters so the position matches where we are at the moment
        const code = lines.join("\r\n");
        return this.parseSelectedDocument(
          code,
          offset,
          line,
          true,
          sourceDocument
        );
      }
    }
    return newDocument;
  }

  public parseDocumentChanged(
    documentText: string,
    fixedSource: boolean,
    sourceDocument: SourceDocument
  ): ParsedDocument {
    const foundDocument = this.parsedDocumentsCache.find(
      (x) => x.sourceDocument.absolutePath === sourceDocument.absolutePath
    );
    if (foundDocument != null) {
      if (
        foundDocument.sourceDocument.unformattedCode ===
        sourceDocument.unformattedCode
      ) {
        return foundDocument;
      }
      this.parsedDocumentsCache = this.parsedDocumentsCache.filter(
        (x) => x !== foundDocument
      );
    }
    const newDocument: ParsedDocument = new ParsedDocument();
    try {
      const result = solparse.parse(documentText);

      newDocument.initialiseDocument(
        result,
        null,
        sourceDocument,
        fixedSource ? documentText : null
      );

      this.parsedDocumentsCache.push(newDocument);
    } catch (error) {
      console.log("parsedDocumentChange", error.message);
      /*
        // if we error parsing (cannot cater for all combos) we fix by removing current line.
        const lines = documentText.split(/\r?\n/g);
        if (lines[line].trim() !== '') { // have we done it already?
            lines[line] = ''.padStart(lines[line].length, ' '); // adding the same number of characters so the position matches where we are at the moment
            const code = lines.join('\r\n');
            return this.parseDocument(code, true, sourceDocument);
        }*/
    }
    return newDocument;
  }

  public parseDocument(
    documentText: string,
    fixedSource: boolean,
    sourceDocument: SourceDocument
  ): ParsedDocument {
    const foundDocument = this.parsedDocumentsCache.find(
      (x) => x.sourceDocument.absolutePath === sourceDocument.absolutePath
    );
    const newDocument = new ParsedDocument();
    if (foundDocument != null) {
      if (
        foundDocument.sourceDocument.unformattedCode ===
        sourceDocument.unformattedCode
      ) {
        newDocument.initialiseDocument(
          foundDocument.element,
          null,
          sourceDocument,
          foundDocument.fixedSource
        );

        this.parsedDocumentsCache.push(newDocument);
        this.parsedDocumentsCache = this.parsedDocumentsCache.filter(
          (x) => x !== foundDocument
        );
        return newDocument;
      }
      this.parsedDocumentsCache = this.parsedDocumentsCache.filter(
        (x) => x !== foundDocument
      );
    }
    try {
      const result = solparse.parse(documentText);

      newDocument.initialiseDocument(
        result,
        null,
        sourceDocument,
        fixedSource ? documentText : null
      );

      this.parsedDocumentsCache.push(newDocument);
    } catch (error) {
      console.debug("parseDocument", error);
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
    return newDocument;
  }

  public getContracts(
    documentText: string,
    document: ParsedDocument
  ): ParsedContract[] {
    const contracts: ParsedContract[] = [];
    try {
      const result: Element = solparse.parse(documentText);
      result.body.forEach((element) => {
        if (
          element.type === "ContractStatement" ||
          element.type === "LibraryStatement" ||
          element.type === "InterfaceStatement"
        ) {
          const contract = new ParsedContract();
          contract.initialise(element, document);
          contracts.push(contract);
        }
      });
    } catch (error) {
      // console.log(JSON.stringify(error));
      // gracefule catch
      // console.log(error.message);
    }
    return contracts;
  }

  private findElementByOffset(
    elements: Array<{ start: number; end: number }>,
    offset: number
  ): any {
    return elements.find(
      (element) => element.start <= offset && offset <= element.end
    );
  }
}
