import { DocUtil } from "@server/utils/text-document"
import { keccak256Regexp } from "@shared/regexp"
import { keccak256, toBytes } from "viem"
import * as vscode from "vscode-languageserver"
import { ParsedExpression, ParsedExpressionIdentifier } from "../code/ParsedExpression"
import { CodeWalkerService } from "../codewalker"
import { getReferences, handleParsedExpression } from "./definition"
import { useProviderHelper } from "./utils/common"
import { isComment } from "./utils/matchers"

export const provideHover = (document: vscode.TextDocument, position: vscode.Position, walker: CodeWalkerService) => {
	try {
		const docUtil = new DocUtil(document, DocUtil.positionRange(position), walker)
		const { range, offset, reset } = useProviderHelper("hover", docUtil)
		const [item, selectedDocument] = docUtil.getSelected()
		const text = document.getText(range)
		if (keccak256Regexp().test(text)) {
			reset()
			return {
				contents: {
					kind: vscode.MarkupKind.Markdown,
					value: `### ${keccak256(toBytes(keccak256Regexp().exec(text)[0]))}`,
				},
			}
		} else if (isComment(text)) {
			reset()
			return null
		} else if (selectedDocument != null) {
			// const selectedFunction = selectedDocument.getSelectedFunction(offset)
			if (!item) {
				reset()
				return null
			} else {
				if (item.getHover) {
					reset()
					return item.getHover()
				}
			}

			if (item instanceof ParsedExpression) {
				const results = handleParsedExpression(selectedDocument, item, docUtil)
				if (results?.length && results[0].getHover) {
					reset()
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
			if (res.contents?.value) {
				reset()
				return res
			} else if (itemExp.parent) {
				const parentMapping =
					// @ts-expect-error
					item.parent?.reference?.element?.literal?.literal?.to?.literal
				// const allFound = selectedDocument.brute(item.name, true)
				const def = getReferences(docUtil)
				reset()
				return def[0].getHover()

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
			}
		}

		reset()
		return null
	} catch (e) {
		// console.error('hover', e);
		return null
	}
}
