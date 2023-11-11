import { DocUtil } from "@server/utils/text-document"
import * as vscode from "vscode-languageserver/node"
import { documents } from "../../../server"
import { CodeWalkerService } from "../../codewalker"
import { ProviderRequestHelp } from "../../server-types"
import { getCodeWalkerService } from "../../server-utils"
import { clearCaches } from "./caches"
export const providerRequest: ProviderRequestHelp = {
	currentOffset: 0,
	currentLine: 0,
	position: vscode.Position.create(0, 0),
	lineText: "",
}

export const useProviderHelper = (action: "definition" | "references" | "hover", util: DocUtil) => {
	const [, selectedDocument, offset] = util.getSelected()
	const range = util.lineRange()
	providerRequest.currentOffset = offset
	providerRequest.currentLine = util.position.line
	providerRequest.currentRange = util.range
	providerRequest.position = util.position
	providerRequest.action = action
	providerRequest.selectedDocument = selectedDocument
	providerRequest.lineText = util.lineText()
	return {
		selectedDocument,
		range,
		offset,
		reset: () => {
			clearCaches()
			providerRequest.currentOffset = 0
			providerRequest.currentLine = 0
			providerRequest.lineText = ""
			providerRequest.position = vscode.Position.create(0, 0)
			providerRequest.currentRange = undefined
			providerRequest.action = undefined
		},
	}
}

export const providerParams = (handler: any): [vscode.TextDocument, vscode.Position, CodeWalkerService] => {
	return [documents.get(handler.textDocument.uri), handler.position, getCodeWalkerService()]
}
