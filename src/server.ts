import { getCodeActionFixes } from "@server/actions/server-code-actions"
import { provideHover } from "@server/providers/hover"
import { provideSignatureHelp } from "@server/providers/signatures"
import { validateAllDocuments, validateDocument } from "@server/server-diagnostics"
import { DocUtil } from "@server/utils/text-document"
import { filesCache } from "@shared/project/project"
import { TextDocument } from "vscode-languageserver-textdocument"
import * as vscode from "vscode-languageserver/node"
import { DidChangeConfigurationNotification } from "vscode-languageserver/node"
import { getCompletionItems } from "./server/providers/completions"
import { getDefinition } from "./server/providers/definition"
import { getAllReferencesToItem } from "./server/providers/references"
import { providerParams } from "./server/providers/utils/common"
import { executeCommand } from "./server/server-commands"
import { compilerInitialized, configureServerCachePath } from "./server/server-compiler"
import { getConfig, handleConfigChange, handleInitialize, handleInitialized, settings } from "./server/server-config"
import type { CommandParamsBase } from "./server/server-types"
import { getCodeWalkerService, initCommon } from "./server/server-utils"

export const documents = new vscode.TextDocuments(TextDocument)

let hasConfigurationCapability = false
export const connection = vscode.createConnection(
	vscode.ProposedFeatures.all,
	new vscode.IPCMessageReader(process),
	new vscode.IPCMessageWriter(process),
)
console.log = connection.console.log.bind(connection.console)
console.error = connection.console.error.bind(connection.console)

/* -------------------------------------------------------------------------- */
/*                                    Init                                    */
/* -------------------------------------------------------------------------- */
connection.onInitialize((params) => {
	const result = handleInitialize(params)
	configureServerCachePath(params.initializationOptions.solcCachePath)
	hasConfigurationCapability = !!(params.capabilities.workspace && !!params.capabilities.workspace.configuration)
	return result
})

connection.onInitialized(async (params) => {
	await handleInitialized()
	if (hasConfigurationCapability) {
		connection.client.register(DidChangeConfigurationNotification.type, undefined)
	}
})
connection.onRequest("CompilerError", (params) => {
	console.debug("CompilerError", params)
})
/* -------------------------------------------------------------------------- */
/*                                   Actions                                  */
/* -------------------------------------------------------------------------- */
connection.onCompletion((handler) => {
	initCommon(handler.textDocument)
	return [...new Set(getCompletionItems(...providerParams(handler)))]
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
	try {
		initCommon(handler.textDocument)
		return provideHover(...providerParams(handler))
	} catch (e: any) {
		console.debug("Unhandled", e)
	}
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
		console.debug("Unhandled", e.message)
		return null
	}
})

connection.onDidChangeWatchedFiles(({ changes }) => {
	if (settings.linter != null) settings.linter.loadFileConfig(settings.rootPath)
	if (!changes.some((change) => change.uri.includes("foundry.toml") || change.uri.includes("solhint.json"))) return

	handleConfigChange({} as any)
	filesCache.clear()
	return validateAllDocuments()
})

connection.onCodeAction((handler) => {
	initCommon(handler.textDocument)
	const docUtil = new DocUtil(handler.textDocument, handler.range, getCodeWalkerService())
	return getCodeActionFixes(docUtil, handler.context.diagnostics)
})

connection.onDidChangeConfiguration(async (change) => {
	await handleConfigChange(change)
	if (settings.linter != null) settings.linter.loadFileConfig(settings.rootPath)
	filesCache.clear()
	return validateAllDocuments()
})

documents.onDidChangeContent(async (event) => {
	const config = getConfig()
	if (!config.validation.onChange || event.document.version < 1 || !compilerInitialized) return
	return validateDocument(event.document)
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
	const config = getConfig()
	if (!config.validation.onOpen || !compilerInitialized) return
	return validateDocument(event.document)
})

documents.onDidSave(async (event) => {
	const config = getConfig()

	if (!config.validation.onSave || !compilerInitialized) return
	return validateDocument(event.document)
})

documents.listen(connection)

connection.listen()

// connection.languages.semanticTokens.onRange((params) => {
// 	// Implement your logic to provide semantic tokens for the given document here.
// 	// You should return the semantic tokens as a response.
// 	const semanticTokens = computeSemanticTokens(
// 		documents.get(params.textDocument.uri),
// 		params.range,
// 		getCodeWalkerService(),
// 	)
// 	return semanticTokens
// })

// connection.onRequest("textDocument/semanticTokens/full", (params) => {
// 	initCommon(params.textDocument)
// 	console.debug("Semantic token requets")

// 	const handler = {
// 		...params,
// 		position: { line: 0, character: 0 },
// 	}
// 	const [document, position, walker] = providerParams(handler)
// 	// Implement your logic to provide semantic tokens for the given document here.
// 	// You should return the semantic tokens as a response.
// 	const semanticTokens = computeSemanticTokens(new DocUtil(document, DocUtil.positionRange(position), walker))
// 	return semanticTokens
// })
