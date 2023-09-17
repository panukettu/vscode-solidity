import * as vscode from "vscode-languageserver/node";
import { SolcCompiler, compilerType } from "../common/solcCompiler";
import { config, settings } from "./settings";
import { URI } from "vscode-uri";
import { initCommon } from "./utils";
import { connection, documents } from "../server";
import { CompilerError } from "./types";

// flags to avoid trigger concurrent validations (compiling is slow)
export let validatingDocument = false;
export let validatingAllDocuments = false;

export let solcCompiler: SolcCompiler;

export let solcCachePath = "";

export function initCompiler(params: vscode.InitializeParams) {
  solcCachePath = params.initializationOptions;
  solcCompiler = new SolcCompiler(settings.rootPath);
  solcCompiler.setSolcCache(solcCachePath);
}

export function handleOnChangeValidation(
  event: vscode.TextDocumentChangeEvent<vscode.TextDocument>
) {
  const document = event.document;
  if (!validatingDocument && !validatingAllDocuments) {
    validatingDocument = true; // control the flag at a higher level
    // slow down, give enough time to type (1.5 seconds?)
    setTimeout(() => validate(document), config.validationDelay);
  }
}

export function validateAllDocuments() {
  if (!validatingAllDocuments) {
    try {
      validatingAllDocuments = true;
      documents.all().forEach(validate);
    } finally {
      validatingAllDocuments = false;
    }
  }
}

export async function startValidation() {
  if (!config.enabledAsYouTypeCompilationErrorCheck) {
    return validateAllDocuments();
  }

  solcCompiler.initialiseAllCompilerSettings(config, config.defaultCompiler);

  solcCompiler
    .initialiseSelectedCompiler()
    .then(() => {
      connection.console.info(
        "Validating using the compiler selected: " +
          compilerType[config.defaultCompiler]
      );
      validateAllDocuments();
    })
    .catch((reason) => {
      connection.console.error(
        "An error has occurred initialising the compiler selected " +
          compilerType[config.defaultCompiler] +
          ", please check your settings, reverting to the embedded compiler. Error: " +
          reason
      );
      solcCompiler.initialiseAllCompilerSettings(config, compilerType.embedded);
      solcCompiler
        .initialiseSelectedCompiler()
        .then(() => {
          validateAllDocuments();
          // tslint:disable-next-line:no-empty
        })
        .catch(() => {});
    });
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
    if (config.enabledAsYouTypeCompilationErrorCheck) {
      try {
        const errors: CompilerError[] =
          solcCompiler.compileSolidityDocumentAndGetDiagnosticErrors(
            filePath,
            documentText,
            config
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
