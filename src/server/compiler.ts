import debounce from "lodash.debounce";
// import throttle from "lodash.throttle";
import * as vscode from "vscode-languageserver/node";
import { URI } from "vscode-uri";
import { SolcCompiler, compilerType } from "../common/solcCompiler";
import { connection, documents } from "../server";
import { config, settings } from "./settings";
import { CompilerError } from "./types";
import { initCommon } from "./utils";
// flags to avoid trigger concurrent validations (compiling is slow)
export let validatingDocument = false;
export let validatingAllDocuments = false;

export let solcCompiler: SolcCompiler;
export let compilerInitialized = false;
// export let isValidating = false;

export let solcCachePath = "";
const versionMap = new Map<string, number>();

export function initCompiler(params: vscode.InitializeParams) {
	solcCachePath = params.initializationOptions;
	solcCompiler = new SolcCompiler(settings.rootPath);
	solcCompiler.setSolcCache(solcCachePath);
}
const validateDebounced = debounce(validate, config.validationDelay, {
	leading: false,
	trailing: true,
});
// const validateThrottle = throttle(validate, config.validationDelay, {
// 	leading: false,
// 	trailing: true,
// });

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

export async function initCompilerSettings() {
	// return;

	solcCompiler.initialiseAllCompilerSettings(config, config.defaultCompiler);

	solcCompiler
		.initialiseSelectedCompiler()
		.then(() => {
			connection.console.info(
				`Compiler initialized: ${compilerType[config.defaultCompiler]}`,
			);
			// validateAllDocuments();
		})
		.catch((reason) => {
			connection.console.error(
				`Compiler initialization failed: ${
					compilerType[config.defaultCompiler]
				}, reverting to embedded compiler. Error: ${reason}`,
			);
			solcCompiler.initialiseAllCompilerSettings(config, compilerType.embedded);
			solcCompiler.initialiseSelectedCompiler()

			.catch(() => {});
		});

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
			if (settings.linter !== null) {
				linterDiagnostics = settings.linter.validate(filePath, documentText);
			}
		} catch (e) {
			// console.debug("linter:", e);
		}
		if (config.validateOnChange || config.validateOnOpen) {
			try {
				const errors: CompilerError[] =
					solcCompiler.compileSolidityDocumentAndGetDiagnosticErrors(
						filePath,
						documentText,
						config,
					);
				errors.forEach((errorItem) => {
					const uriCompileError = URI.file(errorItem.fileName);
					if (uriCompileError.toString() === uri) {
						compileErrorDiagnostics.push(errorItem.diagnostic);
					}
				});
			} catch (e) {
				console.debug("validate:", e);
			}
		}

		const diagnostics = linterDiagnostics.concat(compileErrorDiagnostics);
		connection.sendDiagnostics({ uri: document.uri, diagnostics });
	} finally {
		validatingDocument = false;
	}
}
