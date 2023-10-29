import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver/node';
import { compilerInitialized, initCompiler, validateAllDocuments, validateDocument } from './server/compiler';
import { ExecuteCommandProvider } from './server/providers/command';
import { getCompletionItems } from './server/providers/completions';
import { getDefinition } from './server/providers/definition';
import { SolidityHoverProvider } from './server/providers/hoverProvider';
import { SolidityReferencesProvider } from './server/providers/references';
import { SignatureHelpProvider } from './server/providers/signatures';
import { providerParams } from './server/providers/utils/common';
import { config, handleConfigChange, handleInitialize, handleInitialized, settings } from './server/settings';
import { CommandParamsBase } from './server/types';
import { getCodeWalkerService, initCommon } from './server/utils';

export const documents = new vscode.TextDocuments(TextDocument);

export const connection = vscode.createConnection(vscode.ProposedFeatures.all);
console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

/* -------------------------------------------------------------------------- */
/*                                    Init                                    */
/* -------------------------------------------------------------------------- */
connection.onInitialize((params) => {
	const result = handleInitialize(params);
	initCompiler(params);
	return result;
});

connection.onInitialized((params) => {
	handleInitialized();
});

/* -------------------------------------------------------------------------- */
/*                                   Actions                                  */
/* -------------------------------------------------------------------------- */
connection.onCompletion((handler) => {
	initCommon(handler.textDocument);
	const result = getCompletionItems(...providerParams(handler));
	return [...new Set(result)];
});

connection.onReferences((handler) => {
	initCommon(handler.textDocument);
	return SolidityReferencesProvider.provideReferences(...providerParams(handler));
});

connection.onDefinition((handler) => {
	initCommon(handler.textDocument);
	return getDefinition(...providerParams(handler));
});

connection.onHover((handler) => {
	initCommon(handler.textDocument);
	return SolidityHoverProvider.provideHover(...providerParams(handler));
});

connection.onSignatureHelp((handler) => {
	initCommon(handler.textDocument);
	return SignatureHelpProvider.provideSignatureHelp(...providerParams(handler));
});

connection.onExecuteCommand((args) => {
	const [document, range] = args.arguments as CommandParamsBase;

	try {
		return ExecuteCommandProvider.executeCommand(
			args,
			documents.get(document.uri.external),
			vscode.Range.create(range[0], range[1]),
			getCodeWalkerService()
		);
	} catch (e) {
		console.debug('Unhandled', e.message);
		return null;
	}
});

/* -------------------------------------------------------------------------- */
/*                                    Misc                                    */
/* -------------------------------------------------------------------------- */

connection.onDidChangeWatchedFiles((_change) => {
	if (settings.linter != null) {
		settings.linter.loadFileConfig(settings.rootPath);
	}
	validateAllDocuments();
});

connection.onDidChangeConfiguration((change) => handleConfigChange(change));

documents.onDidChangeContent((event) => {
	if (!config.validateOnChange || event.document.version < 2 || !compilerInitialized) return;
	validateDocument(event.document);
});

/* -------------------------------------------------------------------------- */
/*                                  Documents                                 */
/* -------------------------------------------------------------------------- */

// remove diagnostics from the Problems panel when we close the file
documents.onDidClose((event) =>
	connection.sendDiagnostics({
		diagnostics: [],
		uri: event.document.uri,
	})
);
documents.onDidOpen(async (event) => {
	if (!config.validateOnOpen || !compilerInitialized) return;
	validateDocument(event.document);
});
documents.onDidSave(async (event) => {
	if (!config.validateOnSave || !compilerInitialized) return;
	validateDocument(event.document);
});

documents.listen(connection);

connection.listen();
