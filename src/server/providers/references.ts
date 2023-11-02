import { ParsedDocument } from "@server/code/ParsedDocument"
import { ParsedExpression } from "@server/code/ParsedExpression"
import * as vscode from "vscode-languageserver"
import { CodeWalkerService } from "../codewalker"
import { handleParsedExpression } from "./definition"
import { clearCaches } from "./utils/caches"
import { providerRequest } from "./utils/common"

export const getAllReferencesToItem = (walker: CodeWalkerService, activeDocument: ParsedDocument, offset: number) => {
	let references: vscode.Location[] = []
	try {
		const item = activeDocument.getSelectedItem(offset)
		if (!item) return references

		if (item instanceof ParsedExpression) {
			const result = handleParsedExpression(activeDocument, item)
			if (result?.length) references = references.concat(result.map((x) => x.getLocation()))
		}

		references = references.concat(
			activeDocument
				.getAllReferencesToSelected(offset, walker.parsedDocumentsCache)
				.filter((x) => x && x.location != null)
				.map((x) => x.location),
		)

		providerRequest.selectedDocument = activeDocument

		// ugleeh
		for (const doc of walker.parsedDocumentsCache) {
			let found = []
			// @ts-expect-error
			if (!item?.reference) {
				found = doc.getAllReferencesToObject(item)
			} else {
				// @ts-expect-error
				found = doc.getAllReferencesToObject(item.reference)
			}

			references = references.concat(found.filter((x) => x && x.location != null).map((x) => x.location))
		}

		providerRequest.selectedDocument = null
		clearCaches()
		return references.filter((x) => x.range != null && x.uri)
	} catch (e) {
		providerRequest.selectedDocument = null
		clearCaches()
		return references
	}
}
