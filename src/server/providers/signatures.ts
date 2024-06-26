import { DocUtil } from "@server/utils/text-document"
import { nameRegexp } from "@shared/regexp"
import * as vscode from "vscode-languageserver/node"
import { CodeWalkerService } from "../codewalker"
import { findByParam, getFunctionsByNameOffset } from "./utils/functions"
import { isLeavingFunctionParams } from "./utils/matchers"

export const provideSignatureHelp = (
	document: vscode.TextDocument,
	position: vscode.Position,
	walker: CodeWalkerService,
) => {
	return new Promise<vscode.SignatureHelp | null>((resolve) => {
		try {
			const docUtil = new DocUtil(document, DocUtil.positionRange(position), walker)
			const text = docUtil.lineText()
			const dotStart = text.lastIndexOf(".") !== -1

			const functionNames = text.match(nameRegexp)

			if (!functionNames?.length || isLeavingFunctionParams(text, position.character)) return null
			const index =
				text.slice(text.indexOf(functionNames[functionNames.length - 1]), position.character).split(",").length - 1
			const functionsFound = getFunctionsByNameOffset(functionNames, docUtil)

			// const skipSelf = functionNames.length === 2 || functionNames.length === 4;
			const { parameters, inputs, selectedFunction } = findByParam(functionsFound, index, undefined, dotStart)
			if (!parameters?.length) return null
			const activeParameter = Math.min(index, parameters.length - 1)

			const result = vscode.SignatureInformation.create(
				inputs[activeParameter].getSignatureInfo(activeParameter, dotStart),
			)
			result.parameters = parameters
			result.activeParameter = activeParameter

			resolve({
				activeParameter: result.activeParameter,
				signatures: [result],
				activeSignature: 0,
			})
		} catch (e) {
			// console.debug("SignatureHelp", e);
			resolve(null)
		}
	})
}
