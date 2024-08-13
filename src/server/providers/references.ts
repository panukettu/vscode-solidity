import { ParsedExpression } from "@server/code/ParsedExpression"
import type { DocUtil } from "@server/utils/text-document"
import type * as vscode from "vscode-languageserver"
import { handleParsedExpression } from "./definition"
import { clearCaches } from "./utils/caches"
import { providerRequest } from "./utils/common"

export const getAllReferencesToItem = (docs: DocUtil) => {
	return new Promise<vscode.Location[]>((res) => {
		let result: vscode.Location[] = []
		try {
			const [item, activeDocument, offset] = docs.getSelected()
			if (!item) return result

			if (item instanceof ParsedExpression) {
				const found = handleParsedExpression(activeDocument, item, docs)
				if (found?.length) result = result.concat(found.map((x) => x.getLocation()))
			}

			result = result.concat(
				activeDocument
					.getAllReferencesToSelected(offset, docs.walker.parsedDocumentsCache)
					.filter((x) => x && x.location != null)
					.map((x) => x.location),
			)

			providerRequest.selectedDocument = activeDocument
			providerRequest.currentOffset = offset

			// ugleeh
			for (const doc of docs.walker.parsedDocumentsCache) {
				let found = []
				// @ts-expect-error
				if (!item?.reference) {
					found = doc.getAllReferencesToObject(item)
				} else {
					// @ts-expect-error
					found = doc.getAllReferencesToObject(item.reference)
				}

				result = result.concat(found.filter((x) => x && x.location != null).map((x) => x.location))
			}

			providerRequest.selectedDocument = null
			providerRequest.currentOffset = 0
			clearCaches()
			res(removeDuplicates(result.filter((x) => x.range != null && x.uri)))
		} catch (e) {
			console.debug(e)
			providerRequest.selectedDocument = null
			providerRequest.currentOffset = 0
			clearCaches()
			res(result)
		}
	})
}

const removeDuplicates = (foundLocations: vscode.Location[]) => {
	return foundLocations.filter(
		(v, i, a) => a.findIndex((t) => t.uri === v.uri && t.range.start.character === v.range.start.character) === i,
	)
}
