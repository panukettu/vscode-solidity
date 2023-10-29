import debounce from 'lodash.debounce';
import * as vscode from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { CompilerType, SolcCompiler } from '../common/solcCompiler';
import { connection } from '../server';
import { config as configImport, settings } from './settings';
import { CompilerError, SolidityConfig } from './types';
import { initCommon } from './utils';
export let validatingDocument = false;
export let validatingAllDocuments = false;

export let solcCompiler: SolcCompiler;
export let compilerInitialized = false;
export let solcCachePath = '';

const versionMap = new Map<string, number>();

export function initCompiler(params: vscode.InitializeParams) {
	solcCachePath = params.initializationOptions;
	solcCompiler = new SolcCompiler(settings.rootPath);
	solcCompiler.setSolcCache(solcCachePath);
}
const validateDebounced = debounce(validate, configImport.validationDelay, {
	leading: false,
	trailing: true,
});

export function validateDocument(document: vscode.TextDocument) {
	const version = versionMap.get(document.uri);

	if (version === document.version) {
		return;
	} else {
		versionMap.set(document.uri, document.version);
		validateDebounced(document);
	}
}

export function validateAllDocuments() {
	if (!validatingAllDocuments) {
		try {
			validatingAllDocuments = true;
			// documents.all().forEach(validateThrottle);
		} finally {
			validatingAllDocuments = false;
		}
	}
}

export async function initCompilerSettings(config: SolidityConfig) {
	try {
		solcCompiler.initialiseAllCompilerSettings(config, config.compilerType);
		await solcCompiler.initialiseSelectedCompiler();
		connection.console.info(
			`${CompilerType[solcCompiler.type]} solc ready (${solcCompiler.getCompiler().getVersion()})`
		);
	} catch (reason) {
		connection.console.error(
			`${CompilerType[config.compilerType]} solc setup failed: ${reason}. Trying to use default.`
		);
		solcCompiler.initialiseAllCompilerSettings(config, CompilerType.Default);
		connection.console.info(`Default solc ready (${solcCompiler.getCompiler().getVersion()})`);
		try {
			await solcCompiler.initialiseSelectedCompiler();
		} catch (e) {
			console.debug('Unhandled:', e);
		}
	}

	compilerInitialized = true;
}

export function validate(document: vscode.TextDocument) {
	try {
		initCommon(document);
		validatingDocument = true;

		const uri = document.uri;
		const filePath = URI.parse(uri).fsPath;

		const documentText = document.getText();
		let linterDiagnostics: vscode.Diagnostic[] = [];
		const compileErrorDiagnostics: vscode.Diagnostic[] = [];
		try {
			if (settings.linter != null) {
				linterDiagnostics = settings.linter.validate(filePath, documentText);
			}
		} catch (e) {
			// console.debug("linter:", e);
		}
		if (configImport.validateOnChange || configImport.validateOnOpen) {
			try {
				const errors: CompilerError[] = solcCompiler.compileSolidityDocumentAndGetDiagnosticErrors(
					filePath,
					documentText,
					configImport,
					configImport.compilerType
				);
				for (const errorItem of errors) {
					const uriCompileError = URI.file(errorItem.fileName);
					if (uriCompileError.toString() === uri) {
						compileErrorDiagnostics.push(errorItem.diagnostic);
					}
				}
			} catch (e) {
				console.debug('Unhandled:', e);
			}
		}

		const diagnostics = linterDiagnostics.concat(compileErrorDiagnostics);
		connection.sendDiagnostics({ uri: document.uri, diagnostics });
	} finally {
		validatingDocument = false;
	}
}
