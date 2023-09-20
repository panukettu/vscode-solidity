"use strict";
import * as vscode from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CompletionService } from "./server/providers/completions";
import { SolidityDefinitionProvider } from "./server/providers/definition";
import { SolidityReferencesProvider } from "./server/providers/references";
import { SignatureHelpProvider } from "./server/providers/signatures";
import { providerParams } from "./server/providers/utils/common";
import {
  handleConfigChange,
  handleInitialize,
  handleInitialized,
  settings,
} from "./server/settings";
import {
  handleOnChangeValidation,
  initCompiler,
  validateAllDocuments,
} from "./server/compiler";
import { getCodeWalkerService, initCommon } from "./server/utils";
import { SolidityHoverProvider } from "./server/providers/hoverProvider";
import { CommandParamsBase } from "./server/types";
import { ExecuteCommandProvider } from "./server/providers/command";

export const documents = new vscode.TextDocuments(TextDocument);
// Create a connection for the server
export const connection = vscode.createConnection(vscode.ProposedFeatures.all);
console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

export const profiler = (id: string, func: Function): any => {
  return (...args: any[]) => {
    // const start = Date.now();
    const result = func(...args);
    // const end = Date.now();
    // console.log(`Function ${id} took ${end - start}ms`);
    return result;
  };
};
/* -------------------------------------------------------------------------- */
/*                                    Init                                    */
/* -------------------------------------------------------------------------- */
connection.onInitialize(
  profiler("initialize", (params) => {
    const result = handleInitialize(params);
    initCompiler(params);
    return result;
  })
);

connection.onInitialized(
  profiler("onInitialized", (params) => {
    handleInitialized();
  })
);

/* -------------------------------------------------------------------------- */
/*                                   Actions                                  */
/* -------------------------------------------------------------------------- */
connection.onCompletion(
  profiler("onCompletion", (handler: { textDocument: any }) => {
    const rootPath = initCommon(handler.textDocument);
    const result = new CompletionService(rootPath).getAllCompletionItems(
      ...providerParams(handler)
    );
    return [...new Set(result)];
  })
);

connection.onReferences(
  profiler("onReferences", (handler) => {
    initCommon(handler.textDocument);
    return SolidityReferencesProvider.provideReferences(
      ...providerParams(handler)
    );
  })
);

connection.onDefinition(
  profiler("onDefinition", (handler) => {
    initCommon(handler.textDocument);
    return SolidityDefinitionProvider.provideDefinition(
      ...providerParams(handler)
    );
  })
);

connection.onHover(
  profiler("onHover", (handler) => {
    initCommon(handler.textDocument);
    return SolidityHoverProvider.provideHover(...providerParams(handler));
  })
);

connection.onSignatureHelp(
  profiler("onSignatureHelp", (handler) => {
    initCommon(handler.textDocument);
    return SignatureHelpProvider.provideSignatureHelp(
      ...providerParams(handler)
    );
  })
);

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
    console.log(e.message);
    return null;
  }
});

/* -------------------------------------------------------------------------- */
/*                                    Misc                                    */
/* -------------------------------------------------------------------------- */

connection.onDidChangeWatchedFiles((_change) => {
  if (settings.linter !== null) {
    settings.linter.loadFileConfig(settings.rootPath);
  }
  validateAllDocuments();
});

connection.onDidChangeConfiguration((change) => handleConfigChange(change));

documents.onDidChangeContent((event) => {
  handleOnChangeValidation(event);
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
documents.onDidOpen(async (handler) => {
  // try {
  //   if (codeWalkerService === null) {
  //     initWorkspaceRootFolder(handler.document.uri);
  //     initCurrentProjectInWorkspaceRootFsPath(handler.document.uri);
  //     remappings = loadRemappings(rootPath, remappings);
  //     getCodeWalkerService();
  //   }
  // } catch (e) {
  //   console.debug(e);
  // }
});

documents.listen(connection);

connection.listen();
