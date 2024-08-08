import type { ParsedCode } from "@server/code/ParsedCode"
import type { ParsedDocument } from "@server/code/ParsedDocument"
import { DocUtil } from "@server/utils/text-document"
import { keccak256Regexp } from "@shared/regexp"
import { keccak256, toBytes } from "viem"
import * as vscode from "vscode-languageserver"
import { ParsedExpression, type ParsedExpressionIdentifier } from "../code/ParsedExpression"
import type { CodeWalkerService } from "../codewalker"
import { getReferences, handleParsedExpression } from "./definition"
import { useProviderHelper } from "./utils/common"
import { isComment } from "./utils/matchers"

export const provideHover = (document: vscode.TextDocument, position: vscode.Position, walker: CodeWalkerService) => {
	const docUtil = new DocUtil(document, DocUtil.positionRange(position), walker)
	const { range, reset } = useProviderHelper("hover", docUtil)
	try {
		const [item, selectedDocument] = docUtil.getSelected()
		const text = document.getText(range)
		if (keccak256Regexp().test(text)) {
			return {
				contents: {
					kind: vscode.MarkupKind.Markdown,
					value: `### ${keccak256(toBytes(keccak256Regexp().exec(text)[0]))}`,
				},
			}
		}
		if (isComment(text)) return null
		if (selectedDocument != null) {
			const result = getHover(item, selectedDocument, docUtil)
			if (result) return result
		}

		return null
	} catch (e) {
		// console.debug('hover', e);
		return null
	} finally {
		reset()
	}
}

const getHover = (item: ParsedCode, selectedDocument: ParsedDocument, docUtil: DocUtil) => {
	if (!item) return null
	if (item.getHover) return item.getHover()
	return getHoverExpression(item, selectedDocument, docUtil)
}

const getHoverExpression = (item: ParsedCode, selectedDocument: ParsedDocument, docUtil: DocUtil) => {
	if (item instanceof ParsedExpression) {
		const results = handleParsedExpression(selectedDocument, item, docUtil)
		if (results?.length && results[0].getHover) {
			return results[0].getHover()
		}
	}

	const itemExp = item as ParsedExpressionIdentifier
	if (itemExp.name === "length") {
		return {
			contents: {
				kind: vscode.MarkupKind.Markdown,
				value: [
					"```solidity",
					`(array property) ${itemExp.parent?.name ? `${itemExp.parent.name}.` : ""}length: uint256`,
					"```",
				].join("\n"),
			},
		}
	}

	const res = itemExp.getHover()
	// @ts-expect-error
	if (res.contents?.value) return res
	if (itemExp.parent) {
		const def = getReferences(docUtil)
		return def[0].getHover()
	}
}

// const parentMapping = item.parent?.reference?.element?.literal?.literal?.to?.literal
// const allFound = selectedDocument.brute(item.name, true)
// if (allFound.length === 0) {
// 	reset()
// 	return null
// }
// for (const found of allFound) {
// 	// @ts-expect-error
// 	if (found.struct && found.struct?.name === parentMapping) {
// 		const res = found.getHover()
// 		// @ts-expect-error
// 		if (res.contents?.value) {
// 			reset()
// 			return res
// 		}
// 	} else {
// 		const parentInScope = selectedFunction.findTypeInScope(
// 			// @ts-expect-error
// 			found.parent?.name,
// 		)
// 		if (parentInScope) {
// 			reset()
// 			return found.getHover()
// 		}
// 	}
// }
