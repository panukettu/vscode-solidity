"use strict";
import {
  CodeLens,
  CompletionItem,
  createConnection,
  Diagnostic,
  Hover,
  InitializeResult,
  Location,
  ProposedFeatures,
  Range,
  SignatureHelp,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind,
  WorkspaceFolder,
} from "vscode-languageserver/node";
import { TextDocument as DocumentExecuteCommand } from "vscode";
import { compilerType, SolcCompiler } from "./common/solcCompiler";
import { CompletionService } from "./server/completionService";
import {
  SignatureHelpProvider,
  SolidityDefinitionProvider,
  SolidityHoverProvider,
  SolidityReferencesProvider,
} from "./server/definitionProvider";
import Linter from "./server/linter/linter";
import SolhintService from "./server/linter/solhint";
import { CompilerError } from "./server/solErrorsToDiagnostics";

import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import {
  findFirstRootProjectFile,
  loadRemappings,
} from "./common/projectService";
import { replaceRemappings } from "./common/util";
import { CodeWalkerService } from "./server/parsedCodeModel/codeWalkerService";

import packageJson from "../package.json";
import {
  ExecuteCommandProvider,
  SERVER_COMMANDS_LIST,
} from "./server/commandProvider";

interface SoliditySettings {
  // option for backward compatibilities, please use "linter" option instead
  linter: boolean | string;
  enabledAsYouTypeCompilationErrorCheck: boolean;
  compileUsingLocalVersion: string;
  compileUsingRemoteVersion: string;
  nodemodulespackage: string;
  defaultCompiler: keyof compilerType;
  solhintRules: any;
  validationDelay: number;
  packageDefaultDependenciesDirectory: string | string[];
  packageDefaultDependenciesContractsDirectory: string;
  remappings: string[];
  remappingsWindows: string[];
  remappingsUnix: string[];
  monoRepoSupport: boolean;
}

const defaultSoliditySettings = {} as SoliditySettings;
Object.entries(packageJson.contributes.configuration.properties).forEach(
  ([key, value]) => {
    const keys = key.split(".");
    if (keys.length === 2 && keys[0] === "solidity") {
      defaultSoliditySettings[keys[1]] = value.default;
    }
  }
);

// import * as path from 'path';
// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

const documents = new TextDocuments(TextDocument);

let rootPath: string;
let solcCompiler: SolcCompiler;
let linter: Linter = null;

let enabledAsYouTypeErrorCheck = false;
let compileUsingRemoteVersion = "";
let compileUsingLocalVersion = "";
let nodeModulePackage = "";
let defaultCompiler = compilerType.embedded;
let solhintDefaultRules = {};
let validationDelay = 1500;
let solcCachePath = "";
let hasWorkspaceFolderCapability = false;
let monoRepoSupport = false;
let currentOffset: number | null = null;
// flags to avoid trigger concurrent validations (compiling is slow)
let validatingDocument = false;
let validatingAllDocuments = false;
let packageDefaultDependenciesDirectory: string[] = ["lib", "node_modules"];
let packageDefaultDependenciesContractsDirectory = "src";
let workspaceFolders: WorkspaceFolder[];
let remappings: string[];
let selectedDocument = null;
let selectedProjectFolder = null;
export let codeWalkerService: CodeWalkerService = null;

export function getCodeWalkerService() {
  if (codeWalkerService !== null) {
    if (
      codeWalkerService.rootPath === selectedProjectFolder &&
      codeWalkerService.packageDefaultDependenciesDirectory.sort().join("") ===
        packageDefaultDependenciesDirectory.sort().join("") &&
      codeWalkerService.packageDefaultDependenciesContractsDirectory ===
        packageDefaultDependenciesContractsDirectory &&
      codeWalkerService.remappings.sort().join("") ===
        remappings.sort().join("")
    ) {
      return codeWalkerService;
    }
  }

  codeWalkerService = new CodeWalkerService(
    selectedProjectFolder,
    packageDefaultDependenciesDirectory,
    packageDefaultDependenciesContractsDirectory,
    remappings
  );

  codeWalkerService.initialiseAllDocuments();
  return codeWalkerService;
}

function initWorkspaceRootFolder(uri: string) {
  if (rootPath !== "undefined") {
    const fullUri = URI.parse(uri);
    if (!fullUri.fsPath.startsWith(rootPath)) {
      if (workspaceFolders) {
        const newRootFolder = workspaceFolders.find((x) =>
          uri.startsWith(x.uri)
        );
        if (newRootFolder !== undefined) {
          rootPath = URI.parse(newRootFolder.uri).fsPath;
          solcCompiler.rootPath = rootPath;
          if (linter !== null) {
            linter.loadFileConfig(rootPath);
          }
        }
      }
    }
  }
}

export function initCurrentProjectInWorkspaceRootFsPath(
  currentDocument: string
) {
  if (monoRepoSupport) {
    if (selectedDocument === currentDocument && selectedProjectFolder != null) {
      return selectedProjectFolder;
    }
    const projectFolder = findFirstRootProjectFile(
      rootPath,
      URI.parse(currentDocument).fsPath
    );
    if (projectFolder == null) {
      selectedProjectFolder = rootPath;
      selectedDocument = currentDocument;

      return rootPath;
    } else {
      selectedProjectFolder = projectFolder;
      selectedDocument = currentDocument;
      solcCompiler.rootPath = projectFolder;
      if (linter !== null) {
        linter.loadFileConfig(projectFolder);
      }
      return projectFolder;
    }
  } else {
    // we might have changed settings
    solcCompiler.rootPath = rootPath;
    selectedProjectFolder = rootPath;
    selectedDocument = currentDocument;
    return rootPath;
  }
}

function validate(document: TextDocument) {
  try {
    initWorkspaceRootFolder(document.uri);
    initCurrentProjectInWorkspaceRootFsPath(document.uri);

    validatingDocument = true;
    const uri = document.uri;
    const filePath = URI.parse(uri).fsPath;

    const documentText = document.getText();
    let linterDiagnostics: Diagnostic[] = [];
    const compileErrorDiagnostics: Diagnostic[] = [];
    try {
      if (linter !== null) {
        linterDiagnostics = linter.validate(filePath, documentText);
      }
    } catch {
      // gracefull catch
    }

    try {
      if (enabledAsYouTypeErrorCheck) {
        const errors: CompilerError[] =
          solcCompiler.compileSolidityDocumentAndGetDiagnosticErrors(
            filePath,
            documentText,
            packageDefaultDependenciesDirectory,
            packageDefaultDependenciesContractsDirectory,
            remappings
          );
        errors.forEach((errorItem) => {
          const uriCompileError = URI.file(errorItem.fileName);
          if (uriCompileError.toString() === uri) {
            compileErrorDiagnostics.push(errorItem.diagnostic);
          }
        });
      }
    } catch (e) {
      // gracefull catch
    }

    const diagnostics = linterDiagnostics.concat(compileErrorDiagnostics);
    connection.sendDiagnostics({ uri: document.uri, diagnostics });
  } finally {
    validatingDocument = false;
  }
}

function updateSoliditySettings(soliditySettings: SoliditySettings) {
  enabledAsYouTypeErrorCheck =
    soliditySettings.enabledAsYouTypeCompilationErrorCheck;
  compileUsingLocalVersion = soliditySettings.compileUsingLocalVersion;
  compileUsingRemoteVersion = soliditySettings.compileUsingRemoteVersion;
  solhintDefaultRules = soliditySettings.solhintRules;
  validationDelay = soliditySettings.validationDelay;
  nodeModulePackage = soliditySettings.nodemodulespackage;
  defaultCompiler = compilerType[soliditySettings.defaultCompiler];
  packageDefaultDependenciesContractsDirectory =
    soliditySettings.packageDefaultDependenciesContractsDirectory;
  if (
    typeof soliditySettings.packageDefaultDependenciesDirectory === "string"
  ) {
    packageDefaultDependenciesDirectory = [
      <string>soliditySettings.packageDefaultDependenciesDirectory,
    ];
  } else {
    packageDefaultDependenciesDirectory = <string[]>(
      soliditySettings.packageDefaultDependenciesDirectory
    );
  }
  remappings = soliditySettings.remappings;
  monoRepoSupport = soliditySettings.monoRepoSupport;

  if (process.platform === "win32") {
    remappings = replaceRemappings(
      remappings,
      soliditySettings.remappingsWindows
    );
  } else {
    remappings = replaceRemappings(remappings, soliditySettings.remappingsUnix);
  }

  switch (linterName(soliditySettings)) {
    case "solhint": {
      linter = new SolhintService(rootPath, solhintDefaultRules);
      break;
    }
    default: {
      linter = null;
    }
  }

  if (linter !== null) {
    linter.setIdeRules(linterRules(soliditySettings));
  }

  startValidation();
}

// This handler resolve additional information for the item selected in
// the completion list.
// connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
//   item.
// });
function validateAllDocuments() {
  if (!validatingAllDocuments) {
    try {
      validatingAllDocuments = true;
      documents.all().forEach((document) => validate(document));
    } finally {
      validatingAllDocuments = false;
    }
  }
}

async function startValidation() {
  if (enabledAsYouTypeErrorCheck) {
    solcCompiler.initialiseAllCompilerSettings(
      compileUsingRemoteVersion,
      compileUsingLocalVersion,
      nodeModulePackage,
      defaultCompiler
    );
    solcCompiler
      .initialiseSelectedCompiler()
      .then(() => {
        connection.console.info(
          "Validating using the compiler selected: " +
            compilerType[defaultCompiler]
        );
        validateAllDocuments();
      })
      .catch((reason) => {
        connection.console.error(
          "An error has occurred initialising the compiler selected " +
            compilerType[defaultCompiler] +
            ", please check your settings, reverting to the embedded compiler. Error: " +
            reason
        );
        solcCompiler.initialiseAllCompilerSettings(
          compileUsingRemoteVersion,
          compileUsingLocalVersion,
          nodeModulePackage,
          compilerType.embedded
        );
        solcCompiler
          .initialiseSelectedCompiler()
          .then(() => {
            validateAllDocuments();
            // tslint:disable-next-line:no-empty
          })
          .catch(() => {});
      });
  } else {
    validateAllDocuments();
  }
}

documents.onDidChangeContent((event) => {
  const document = event.document;
  if (!validatingDocument && !validatingAllDocuments) {
    validatingDocument = true; // control the flag at a higher level
    // slow down, give enough time to type (1.5 seconds?)
    setTimeout(() => validate(document), validationDelay);
  }
});

// remove diagnostics from the Problems panel when we close the file
documents.onDidClose((event) =>
  connection.sendDiagnostics({
    diagnostics: [],
    uri: event.document.uri,
  })
);

documents.listen(connection);

connection.onInitialize((params): InitializeResult => {
  rootPath = params.rootPath;
  const capabilities = params.capabilities;

  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  if (params.workspaceFolders) {
    workspaceFolders = params.workspaceFolders;
  }
  solcCachePath = params.initializationOptions;
  solcCompiler = new SolcCompiler(rootPath);
  solcCompiler.setSolcCache(solcCachePath);

  const result: InitializeResult = {
    capabilities: {
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [".", "/", '"', "'", "*"],
      },
      definitionProvider: true,
      referencesProvider: true,
      hoverProvider: true,
      signatureHelpProvider: {
        workDoneProgress: false,
        triggerCharacters: ["(", ","],
      },
      textDocumentSync: TextDocumentSyncKind.Full,
      executeCommandProvider: {
        commands: Object.values(SERVER_COMMANDS_LIST),
      },
    },
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }

  updateSoliditySettings(defaultSoliditySettings);

  return result;
});

connection.onInitialized(() => {
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      if (connection.workspace !== undefined) {
        connection.workspace.onDidChangeWorkspaceFolders((event) => {
          event.removed.forEach((workspaceFolder) => {
            const index = workspaceFolders.findIndex(
              (folder) => folder.uri === workspaceFolder.uri
            );
            if (index !== -1) {
              workspaceFolders.splice(index, 1);
            }
          });
          event.added.forEach((workspaceFolder) => {
            workspaceFolders.push(workspaceFolder);
          });
        });
      }
    });
  }
});

connection.onSignatureHelp((handler): SignatureHelp => {
  initWorkspaceRootFolder(handler.textDocument.uri);
  initCurrentProjectInWorkspaceRootFsPath(handler.textDocument.uri);

  return new SignatureHelpProvider().provideSignatureHelp(
    documents.get(handler.textDocument.uri),
    handler.position,
    getCodeWalkerService()
  );
});

connection.onCompletion(
  (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    const projectRootPath = initCurrentProjectInWorkspaceRootFsPath(
      document.uri
    );

    const service = new CompletionService(projectRootPath);

    const completionItems = service.getAllCompletionItems(
      document,
      textDocumentPosition.position,
      getCodeWalkerService()
    );
    return [...new Set(completionItems)];
  }
);

connection.onReferences((handler: TextDocumentPositionParams): Location[] => {
  initWorkspaceRootFolder(handler.textDocument.uri);
  initCurrentProjectInWorkspaceRootFsPath(handler.textDocument.uri);

  return SolidityReferencesProvider.provideReferences(
    documents.get(handler.textDocument.uri),
    handler.position,
    getCodeWalkerService()
  );
});

connection.onDefinition(
  (handler: TextDocumentPositionParams): Location | Location[] => {
    initWorkspaceRootFolder(handler.textDocument.uri);
    initCurrentProjectInWorkspaceRootFsPath(handler.textDocument.uri);
    return SolidityDefinitionProvider.provideDefinition(
      documents.get(handler.textDocument.uri),
      handler.position,
      getCodeWalkerService()
    );
  }
);

connection.onHover((handler: TextDocumentPositionParams): Hover | undefined => {
  initWorkspaceRootFolder(handler.textDocument.uri);
  initCurrentProjectInWorkspaceRootFsPath(handler.textDocument.uri);
  const provider = new SolidityHoverProvider();
  return provider.provideHover(
    documents.get(handler.textDocument.uri),
    handler.position,
    getCodeWalkerService()
  );
});

type CommandParamsBase = [
  DocumentExecuteCommand & { uri: { external: string } },
  any[]
];

connection.onExecuteCommand((args) => {
  const [document, range] = args.arguments as CommandParamsBase;
  initWorkspaceRootFolder(document.uri.external);
  initCurrentProjectInWorkspaceRootFsPath(document.uri.external);
  try {
    return ExecuteCommandProvider.executeCommand(
      args,
      documents.get(document.uri.external),
      Range.create(range[0], range[1]),
      getCodeWalkerService()
    );
  } catch (e) {
    console.log(e.message);
    return null;
  }
});

connection.onDidChangeWatchedFiles((_change) => {
  if (linter !== null) {
    linter.loadFileConfig(rootPath);
  }
  validateAllDocuments();
});

documents.onDidOpen((handler) => {
  try {
    if (codeWalkerService === null) {
      initWorkspaceRootFolder(handler.document.uri);
      initCurrentProjectInWorkspaceRootFsPath(handler.document.uri);
      remappings = loadRemappings(rootPath, []);
      // packageDefaultDependenciesContractsDirectory = "src";
      getCodeWalkerService();
    }
  } catch (e) {
    console.debug(e);
  }
});

connection.onDidChangeConfiguration((change) => {
  updateSoliditySettings({
    remappings,
    packageDefaultDependenciesContractsDirectory: "src",
    ...defaultSoliditySettings,
    ...(change.settings?.solidity || {}),
  });
});

function linterName(settings: SoliditySettings) {
  return settings.linter;
}

function linterRules(settings: SoliditySettings) {
  //   const _linterName = linterName(settings);
  return settings.solhintRules;
}

connection.listen();
