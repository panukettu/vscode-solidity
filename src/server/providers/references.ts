import * as vscode from "vscode-languageserver";
import { ParsedCode } from "../code/ParsedCode";
import { CodeWalkerService } from "../code/walker/codeWalkerService";
import { clearCaches } from "./utils/caches";
import { providerRequest } from "./utils/common";

export class SolidityReferencesProvider {
  public static currentItem: ParsedCode | null = null;
  public static provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): vscode.Location[] {
    try {
      const offset = document.offsetAt(position);
      // walker.initialiseChangedDocuments();
      const documentContractSelected = walker.getSelectedDocument(
        document,
        position
      );

      this.currentItem = documentContractSelected.getSelectedItem(offset);
      providerRequest.selectedDocument = documentContractSelected;

      let references = [];

      walker.parsedDocumentsCache
        .concat(documentContractSelected)
        .forEach((doc) => {
          let found = [];
          // @ts-expect-error
          if (!this.currentItem.reference) {
            found = doc.getAllReferencesToObject(this.currentItem);
          } else {
            // @ts-expect-error
            found = doc.getAllReferencesToObject(this.currentItem.reference);
          }
          references = references.concat(found);
        });

      const foundLocations = references
        .filter((x) => x != null && x.location !== null)
        .map((x) => x.location);

      this.currentItem = null;
      providerRequest.selectedDocument = null;
      clearCaches();
      return <vscode.Location[]>foundLocations;
    } catch (e) {
      this.currentItem = null;
      providerRequest.selectedDocument = null;
      clearCaches();
      console.debug("ref", e);
    }
  }
}
