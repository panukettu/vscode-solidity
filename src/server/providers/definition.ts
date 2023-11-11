import { ParsedContract } from "@server/code/ParsedContract"
import { ParsedDocument } from "@server/code/ParsedDocument"
import { ParsedExpression, ParsedExpressionIdentifier } from "@server/code/ParsedExpression"
import { ParsedStateVariable } from "@server/code/ParsedStateVariable"
import { ParsedStructVariable } from "@server/code/ParsedStructVariable"
import { ParsedVariable } from "@server/code/ParsedVariable"
import { getCodeWalkerService } from "@server/server-utils"
import { DocUtil } from "@server/utils/text-document"
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
export const handleParsedExpression = (document: ParsedDocument, currentItem: ParsedExpression, util: DocUtil) => {
	const parent = currentItem.parent
	if (!parent) return []
	const parentContract = document.getAllContracts().find((c) => c.name === parent.name)
	if (!parentContract) {
		const typeRefParent = document.brute(parent.name)
		for (const ref of typeRefParent) {
			if (ref instanceof ParsedVariable) {
				if (ref.type.isContract && ref.type.importRef) {
					const contract = ref.type.importRef.documentReference.innerContracts.find((c) => c.name === ref.type.name)
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
		const doc = new DocUtil(document, DocUtil.positionRange(position), walker)
		if (doc.isCommentLine()) return null

		let [currentItem, selectedDoc, currentOffset] = doc.getSelected()

		if (!currentItem) return []

		if (currentItem instanceof ParsedExpression) {
			const result = handleParsedExpression(selectedDoc, currentItem, doc)
			if (result?.length) return result.map((x) => x.getLocation())
		}

		const references = selectedDoc.getSelectedTypeReferenceLocation(currentOffset)
		const refsWorkaround = currentItem.getSelectedTypeReferenceLocation(currentOffset)

		const foundLocations = references
			.concat(refsWorkaround)
			.filter((x) => x.location != null)
			.map((x) => x.location)

		if (!foundLocations?.length) {
			const item = selectedDoc.findTypeInScope(currentItem.name)

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
		console.error("definition", e.message)
		return []
	}
}
const removeDuplicates = (foundLocations: vscode.Location[]) => {
	return foundLocations.filter(
		(v, i, a) => a.findIndex((t) => t.uri === v.uri && t.range.start.character === v.range.start.character) === i,
	)
}
