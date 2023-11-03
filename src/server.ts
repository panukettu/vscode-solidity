import { provideSignatureHelp } from "@server/providers/signatures"
import { TextDocument } from "vscode-languageserver-textdocument"
import * as vscode from "vscode-languageserver/node"
import { getCompletionItems } from "./server/providers/completions"
import { getDefinition } from "./server/providers/definition"
import { SolidityHoverProvider } from "./server/providers/hover"
import { getAllReferencesToItem } from "./server/providers/references"
import { providerParams } from "./server/providers/utils/common"
import { executeCommand } from "./server/server-commands"
import {
	compilerInitialized,
	configureServerCachePath,
	validateAllDocuments,
	validateDocument,
} from "./server/server-compiler"
import { config, handleConfigChange, handleInitialize, handleInitialized, settings } from "./server/server-settings"
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
	console.debug("CompilerError", params)
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
	return getAllReferencesToItem(walker, walker.getSelectedDocument(document, position), document.offsetAt(position))
})

connection.onDefinition((handler) => {
	initCommon(handler.textDocument)
	return getDefinition(...providerParams(handler))
})

connection.onHover((handler) => {
	initCommon(handler.textDocument)
	return SolidityHoverProvider.provideHover(...providerParams(handler))
})

connection.onSignatureHelp((handler) => {
	initCommon(handler.textDocument)
	return provideSignatureHelp(...providerParams(handler))
})

connection.onExecuteCommand((params) => {
	const [document, range] = params.arguments as CommandParamsBase

	try {
		return executeCommand(
			getCodeWalkerService(),
			params,
			document?.uri ? documents.get(document.uri.external) : undefined,
			range ? vscode.Range.create(range[0], range[1]) : undefined,
		)
	} catch (e) {
		console.debug("Unhandled", e.message)
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

connection.onDidChangeConfiguration((change) => handleConfigChange(change))

documents.onDidChangeContent((event) => {
	if (!config.validateOnChange || event.document.version < 2 || !compilerInitialized) return
	validateDocument(event.document)
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
	if (!config.validateOnOpen || !compilerInitialized) return
	validateDocument(event.document)
})
documents.onDidSave(async (event) => {
	if (!config.validateOnSave || !compilerInitialized) return
	validateDocument(event.document)
})

documents.listen(connection)

connection.listen()
