import { clearCaches } from "./utils/caches";
import { CodeWalkerService } from "../code/walker/codeWalkerService";
import { ParsedCode } from "../code/ParsedCode";
import * as vscode from "vscode-languageserver";
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

      const references = documentContractSelected.getAllReferencesToSelected(
        offset,
        walker.parsedDocumentsCache
      );

      const foundLocations = references
        .filter((x) => x != null && x.location !== null)
        .map((x) => x.location);

      this.currentItem = null;
      providerRequest.selectedDocument = null;
      clearCaches();
      return <vscode.Location[]>foundLocations;
    } catch (e) {
      clearCaches();
      // console.debug("ref", e);
    }
  }
}
