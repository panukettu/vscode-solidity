import { ParsedContract } from "@server/code/ParsedContract"
import { ParsedDocument } from "@server/code/ParsedDocument"
import { ParsedExpression, ParsedExpressionIdentifier } from "@server/code/ParsedExpression"
import { ParsedStructVariable } from "@server/code/ParsedStructVariable"
import { getCodeWalkerService } from "@server/server-utils"
import * as vscode from "vscode-languageserver/node"
import { ParsedCode } from "../code/ParsedCode"
import { CodeWalkerService } from "../codewalker"
import { clearCaches } from "./utils/caches"

let currentOffset = 0
let currentItem: ParsedCode | undefined

export function defCtx() {
	return {
		currentOffset,
		currentItem,
	}
}
export const handleParsedExpression = (document: ParsedDocument, currentItem: ParsedExpression) => {
	const parent = currentItem.parent
	if (!parent) return []
	const parentContract = document.getAllContracts().find((c) => c.name === parent.name)
	if (!parentContract) {
		const typeRefParent = document.brute(parent.name)
		for (const ref of typeRefParent) {
			if (ref instanceof ParsedStructVariable) {
				if (ref.isContract && ref.type.name && ref.importRef) {
					const contract = ref.importRef.documentReference.innerContracts.find((c) => c.name === ref.type.name)
					if (contract) {
						const foundMethods = contract.findMethodsInScope(currentItem.name).filter((f) => f?.getLocation)
						if (!foundMethods.length) continue
						return foundMethods
					}
				}
			}
		}
		return []
	}
	const foundMethods = parentContract.findMethodsInScope(currentItem.name).filter((f) => f?.getLocation)
	if (!foundMethods?.length) return []
	return foundMethods
}

export const getDefinition = (document: vscode.TextDocument, position: vscode.Position, walker: CodeWalkerService) => {
	try {
		currentOffset = document.offsetAt(position)
		const documentContractSelected = walker.getSelectedDocument(document, position)
		currentItem = documentContractSelected.getSelectedItem(currentOffset)
		if (!currentItem) return []

		if (currentItem instanceof ParsedExpression) {
			const result = handleParsedExpression(documentContractSelected, currentItem)
			if (result?.length) return result.map((x) => x.getLocation())
		}

		const references = documentContractSelected.getSelectedTypeReferenceLocation(currentOffset)
		const refsWorkaround = currentItem.getSelectedTypeReferenceLocation(currentOffset)

		const foundLocations = references
			.concat(refsWorkaround)
			.filter((x) => x.location != null)
			.map((x) => x.location)

		if (!foundLocations?.length) {
			const item = documentContractSelected.findTypeInScope(currentItem.name)

			if (item?.getLocation) {
				foundLocations.push(item.getLocation())
			}
		}
		currentOffset = 0
		currentItem = undefined
		clearCaches()
		return removeDuplicates(foundLocations)
	} catch (e) {
		clearCaches()
		currentOffset = 0
		currentItem = undefined
		// console.error('definition', e);
		return []
	}
}
const removeDuplicates = (foundLocations: vscode.Location[]) => {
	return foundLocations.filter(
		(v, i, a) => a.findIndex((t) => t.uri === v.uri && t.range.start.character === v.range.start.character) === i,
	)
}
