import { ParsedDocument } from "@server/code/ParsedDocument"
import { ParsedExpression } from "@server/code/ParsedExpression"
import { ParsedVariable } from "@server/code/ParsedVariable"
import { DocUtil } from "@server/utils/text-document"
import * as vscode from "vscode-languageserver/node"
import { ParsedCode } from "../code/ParsedCode"
import { CodeWalkerService } from "../codewalker"
import { clearCaches } from "./utils/caches"

let currentOffset = 0
let currentItem: ParsedCode | undefined
let docUtil: DocUtil | undefined

export function defCtx() {
	return {
		currentOffset,
		docUtil,
		currentItem,
	}
}
export const handleParsedExpression = (document: ParsedDocument, currentItem: ParsedExpression, util: DocUtil) => {
	const parent = currentItem.parent
	if (!parent) return []
	const parentContract = document.getAllContracts().find((c) => c.name === parent.name)
	if (!parentContract) {
		// const typeRefParent = document.brute(parent.name)
		const typeRefParent = getParentRef(util)
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
		docUtil = new DocUtil(document, DocUtil.positionRange(position), walker)
		if (docUtil.isCommentLine()) return null

		let [currentItem, selectedDoc, currentOffset] = docUtil.getSelected()

		if (!currentItem) return []

		if (currentItem instanceof ParsedExpression && currentItem.parent) {
			const result = handleParsedExpression(selectedDoc, currentItem, docUtil)
			console.debug({
				currentItem: result,
				refs: currentItem?.getSelectedTypeReferenceLocation(currentOffset),
			})
			if (result?.length) {
				clearCaches()
				return result.map((x) => x.getLocation())
			}
		}

		const references = currentItem.getSelectedTypeReferenceLocation(currentOffset)

		const foundLocations = references.filter((x) => x.location != null).map((x) => x.location)

		if (!foundLocations?.length) {
			for (const imported of selectedDoc.importedDocuments) {
				const found = imported.findMethodsInScope(currentItem.name).filter((f) => f?.getLocation)
				if (found?.length) {
					foundLocations.push(...found.map((x) => x.getLocation()))
				}
			}
			if (!foundLocations.length) {
				const item = selectedDoc.findTypeInScope(currentItem.name)
				if (item?.getLocation) {
					foundLocations.push(item.getLocation())
				}
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
		console.debug("definition", e.message)
		return null
	}
}

export const getReferences = (docUtil: DocUtil) => {
	const [currentItem, selectedDoc, currentOffset] = docUtil.getSelected()

	const references = currentItem.getSelectedTypeReferenceLocation(currentOffset)

	const foundLocations = references.filter((x) => x.location != null).map((x) => x.reference)

	if (!foundLocations?.length) {
		for (const imported of selectedDoc.importedDocuments) {
			const found = imported.findMethodsInScope(currentItem.name).filter((f) => f?.getLocation)
			if (found?.length) {
				foundLocations.push(...found.map((x) => x))
			}
		}
		if (!foundLocations.length) {
			const item = selectedDoc.findTypeInScope(currentItem.name)
			if (item?.getLocation) {
				foundLocations.push(item)
			}
		}
	}

	return foundLocations
}

export const getParentRef = (docUtil: DocUtil) => {
	const offset = docUtil.document.offsetAt(docUtil.getPreviousWord().start) + 1
	const [, doc] = docUtil.getSelected()
	const parentItem = doc.getSelectedItem(offset)
	const references = parentItem.getSelectedTypeReferenceLocation(offset)

	const foundLocations = references.filter((x) => x.location != null).map((x) => x.reference)
	const item = (parentItem as any)?.reference
	if (item) {
		foundLocations.push(item)
	}
	if (!foundLocations?.length) {
		for (const imported of doc.importedDocuments) {
			const found = imported.findMethodsInScope(parentItem.name).filter((f) => f?.getLocation)
			if (found?.length) {
				foundLocations.push(...found.map((x) => x))
			}
		}
		if (!foundLocations.length) {
			const item = doc.findTypeInScope(parentItem.name)
			if (item?.getLocation) {
				foundLocations.push(item)
			}
		}
	}

	return foundLocations
}

const removeDuplicates = (foundLocations: vscode.Location[]) => {
	return foundLocations.filter(
		(v, i, a) => a.findIndex((t) => t.uri === v.uri && t.range.start.character === v.range.start.character) === i,
	)
}
