import { nameRegexp } from "@shared/regexp"
import * as vscode from "vscode-languageserver/node"
import { CodeWalkerService } from "../codewalker"
import { findByParam, getFunctionsByNameOffset } from "./utils/functions"
import { isLeavingFunctionParams } from "./utils/matchers"

export const provideSignatureHelp = (
	document: vscode.TextDocument,
	position: vscode.Position,
	walker: CodeWalkerService,
): vscode.SignatureHelp => {
	try {
		const documentContractSelected = walker.getSelectedDocumentProfiler(document, position)
		const offset = document.offsetAt(position)
		const line = documentContractSelected.getLineRange(position.line)
		const text = document.getText(line)
		const dotStart = text.lastIndexOf(".") !== -1

		const functionNames = text.match(nameRegexp)

		if (!functionNames?.length || isLeavingFunctionParams(text, position.character)) return null
		const index =
			text.slice(text.indexOf(functionNames[functionNames.length - 1]), position.character).split(",").length - 1
		const functionsFound = getFunctionsByNameOffset(functionNames, documentContractSelected, offset)

		// const skipSelf = functionNames.length === 2 || functionNames.length === 4;
		const { parameters, inputs, selectedFunction } = findByParam(functionsFound, index, undefined, dotStart)
		if (!parameters?.length) return null
		const activeParameter = Math.min(index, parameters.length - 1)

		const result = vscode.SignatureInformation.create(
			inputs[activeParameter].getSignatureInfo(activeParameter, dotStart),
		)
		result.parameters = parameters
		result.activeParameter = activeParameter

		return {
			activeParameter: result.activeParameter,
			signatures: [result],
			activeSignature: 0,
		}
	} catch (e) {
		// console.debug("SignatureHelp", e);
		return null
	}
}
