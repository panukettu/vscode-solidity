import { getCodeActionFixes } from "@server/actions/server-code-actions"
import { provideHover } from "@server/providers/hover"
import { provideSignatureHelp } from "@server/providers/signatures"
import { DocUtil } from "@server/utils/text-document"
import { TextDocument } from "vscode-languageserver-textdocument"
import * as vscode from "vscode-languageserver/node"
import { getCompletionItems } from "./server/providers/completions"
import { getDefinition } from "./server/providers/definition"
import { getAllReferencesToItem } from "./server/providers/references"
import { providerParams } from "./server/providers/utils/common"
import { executeCommand } from "./server/server-commands"
import {
	compilerInitialized,
	configureServerCachePath,
	validateAllDocuments,
	validateDocument,
} from "./server/server-compiler"
import { config, handleConfigChange, handleInitialize, handleInitialized, settings } from "./server/server-config"
import { CommandParamsBase } from "./server/server-types"
import { getCodeWalkerService, initCommon } from "./server/server-utils"

export const documents = new vscode.TextDocuments(TextDocument)

export const connection = vscode.createConnection(vscode.ProposedFeatures.all)
console.log = connection.console.log.bind(connection.console)
console.error = connection.console.error.bind(connection.console)

/* -------------------------------------------------------------------------- */
/*                                    Init                                    */
/* -------------------------------------------------------------------------- */
connection.onInitialize((params) => {
	const result = handleInitialize(params)
	configureServerCachePath(params.initializationOptions.solcCachePath)
	return result
})

connection.onInitialized((params) => {
	handleInitialized()
})
connection.onRequest("CompilerError", (params) => {
	console.error("CompilerError", params)
})
/* -------------------------------------------------------------------------- */
/*                                   Actions                                  */
/* -------------------------------------------------------------------------- */
connection.onCompletion((handler) => {
	initCommon(handler.textDocument)
	const result = getCompletionItems(...providerParams(handler))
	return [...new Set(result)]
})

connection.onReferences((handler) => {
	initCommon(handler.textDocument)
	const [document, position, walker] = providerParams(handler)
	return getAllReferencesToItem(new DocUtil(document, DocUtil.positionRange(position), walker))
})

connection.onDefinition((handler) => {
	initCommon(handler.textDocument)
	return getDefinition(...providerParams(handler))
})

connection.onHover((handler) => {
	initCommon(handler.textDocument)
	return provideHover(...providerParams(handler))
})

connection.onSignatureHelp((handler) => {
	initCommon(handler.textDocument)
	return provideSignatureHelp(...providerParams(handler))
})

connection.onExecuteCommand((params) => {
	const [document, range] = params.arguments as CommandParamsBase
	document && initCommon(document)
	try {
		return executeCommand(
			getCodeWalkerService(),
			params,
			document?.uri ? documents.get(document.uri.external) : undefined,
			range ? vscode.Range.create(range[0], range[1]) : undefined,
		)
	} catch (e) {
		console.log("Unhandled", e.message)
		return null
	}
})

/* -------------------------------------------------------------------------- */
/*                                    Misc                                    */
/* -------------------------------------------------------------------------- */

connection.onDidChangeWatchedFiles((_change) => {
	if (settings.linter != null) {
		settings.linter.loadFileConfig(settings.rootPath)
	}
	validateAllDocuments()
})

connection.onCodeAction((handler) => {
	initCommon(handler.textDocument)
	const docUtil = new DocUtil(handler.textDocument, handler.range, getCodeWalkerService())
	return getCodeActionFixes(docUtil, handler.context.diagnostics)
})

connection.onDidChangeConfiguration((change) => handleConfigChange(change))

documents.onDidChangeContent(async (event) => {
	if (!config.validation.onChange || event.document.version < 2 || !compilerInitialized) return
	return await validateDocument(event.document)
})

/* -------------------------------------------------------------------------- */
/*                                  Documents                                 */
/* -------------------------------------------------------------------------- */

// remove diagnostics from the Problems panel when we close the file
documents.onDidClose((event) => {
	return connection.sendDiagnostics({
		diagnostics: [],
		uri: event.document.uri,
	})
})
documents.onDidOpen(async (event) => {
	if (!config.validation.onOpen || !compilerInitialized) return
	return await validateDocument(event.document)
})

documents.onDidSave(async (event) => {
	if (!config.validation.onSave || !compilerInitialized) return
	return await validateDocument(event.document)
})

documents.listen(connection)

connection.listen()
