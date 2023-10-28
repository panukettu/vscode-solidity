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
		walker: CodeWalkerService,
	): vscode.Location[] {
		try {
			const offset = document.offsetAt(position);

			const documentContractSelected = walker.getSelectedDocumentProfiler(
				document,
				position,
			);
			walker.parsedDocumentsCache.forEach((doc) => {
				doc.initialiseDocumentReferences(walker.parsedDocumentsCache);
			});
			this.currentItem = documentContractSelected.getSelectedItem(offset);
			providerRequest.selectedDocument = documentContractSelected;

			let references = documentContractSelected.getAllReferencesToSelected(
				offset,
				[documentContractSelected].concat(walker.parsedDocumentsCache),
			);

			walker.parsedDocumentsCache.forEach((doc) => {
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
			// console.debug("ref", e);
			return null;
		}
	}
}
