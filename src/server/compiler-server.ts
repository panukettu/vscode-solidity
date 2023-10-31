import { Multisolc } from '@shared/compiler/multisolc';
import { CompilerType } from '@shared/enums';
import type { MultisolcSettings, SolidityConfig } from '@shared/types';
import debounce from 'lodash.debounce';
import * as vscode from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { connection } from '../server';
import { config, config as configImport, getCurrentMultisolcSettings, settings } from './settings';
import { initCommon } from './utils';
export let validatingDocument = false;
export let validatingAllDocuments = false;

export let ServerCompilers: Multisolc;
export let compilerInitialized = false;
export let solcCachePath = '';

export function configureServerCachePath(path: string) {
	solcCachePath = path;
}

const versionMap = new Map<string, number>();

export async function createServerMultisolc(settings: MultisolcSettings) {
	if (!solcCachePath) throw new Error('solcCachePath not set');
	ServerCompilers = new Multisolc(settings, solcCachePath);
	await ServerCompilers.initializeSolc(settings.selectedType);
	compilerInitialized = true;
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

export async function initializeSolc(type: CompilerType) {
	const id = CompilerType[type];
	try {
		await ServerCompilers.initializeSolc(type);
		connection.console.info(`${id} solc ready (${ServerCompilers.getCompiler().getVersion()})`);
	} catch (reason) {
		connection.console.error(`${id} solc initialization fail: ${reason}. Falling back to embedded..`);
		try {
			ServerCompilers.initExternalCompilers(getCurrentMultisolcSettings(config), CompilerType.Extension);
			await ServerCompilers.initializeSolc(CompilerType.Extension);
		} catch (e) {
			connection.console.error(`Unhandled: ${e}`);
			return;
		}
	}

	compilerInitialized = true;
}
let forgeInfoShown = false;
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
		if (configImport.validateOnChange || configImport.validateOnOpen || configImport.validateOnSave) {
			try {
				if (!forgeInfoShown) {
					connection.console.info('Validation support for .t.sol or .s.sol files is incomplete.');
					forgeInfoShown = true;
				}

				const errors = ServerCompilers.compileWithDiagnostic(
					filePath,
					documentText,
					configImport,
					configImport.compilerType
				);

				connection.sendNotification('hello');

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