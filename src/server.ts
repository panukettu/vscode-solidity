"use strict";
import { TextDocument as DocumentExecuteCommand } from "vscode";
import {
  CompletionItem,
  ConfigurationParams,
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

import { findFirstRootProjectFile } from "./common/projectService";
import { replaceRemappings } from "./common/util";
import { CodeWalkerService } from "./server/parsedCodeModel/codeWalkerService";

import { deepEqual } from "fast-equals";
import packageJson from "../package.json";
import {
  ExecuteCommandProvider,
  SERVER_COMMANDS_LIST,
} from "./server/commandProvider";
export interface SoliditySettings<T = compilerType> {
  // option for backward compatibilities, please use "linter" option instead
  linter: boolean | string;
  enabledAsYouTypeCompilationErrorCheck: boolean;
  compileUsingLocalVersion: string;
  compileUsingRemoteVersion: string;
  compilerPackage: string;
  defaultCompiler: T;
  solhintRules: any;
  initExclude: string[];
  validationDelay: number;
  libs: string[];
  libSources: string[];
  sources: string;
  remappings: string[];
  remappingsWindows: string[];
  remappingsUnix: string[];
  monoRepoSupport: boolean;
}

const defaultSoliditySettings = {} as SoliditySettings<keyof compilerType>;
Object.entries(packageJson.contributes.configuration.properties).forEach(
  ([key, value]) => {
    const keys = key.split(".");
    if (keys.length === 2 && keys[0] === "solidity") {
      defaultSoliditySettings[keys[1]] = value.default;
    }
  }
);

// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

const documents = new TextDocuments(TextDocument);

let rootPath: string;
let solcCompiler: SolcCompiler;
let linter: Linter = null;

let settings: SoliditySettings<compilerType> = {
  ...defaultSoliditySettings,
  defaultCompiler: compilerType[defaultSoliditySettings.defaultCompiler],
};

let solcCachePath = "";
let hasWorkspaceFolderCapability = false;
// flags to avoid trigger concurrent validations (compiling is slow)
let validatingDocument = false;
let validatingAllDocuments = false;

let workspaceFolders: WorkspaceFolder[];
let selectedDocument = null;
let selectedProjectFolder = null;
export let codeWalkerService: CodeWalkerService = null;

export function getCodeWalkerService() {
  if (codeWalkerService !== null) {
    if (
      codeWalkerService.rootPath === selectedProjectFolder &&
      deepEqual(codeWalkerService.settings, settings)
    ) {
      return codeWalkerService;
    }
  }

  return (codeWalkerService = new CodeWalkerService(
    selectedProjectFolder,
    settings
  ));
}

function initWorkspaceRootFolder(uri: string) {
  if (rootPath) return;

  const fullUri = URI.parse(uri);
  if (!fullUri.fsPath.startsWith(rootPath)) {
    if (workspaceFolders) {
      const newRootFolder = workspaceFolders.find((x) => uri.startsWith(x.uri));
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

export function initCurrentProjectInWorkspaceRootFsPath(
  currentDocument: string
) {
  if (settings.monoRepoSupport) {
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
    } catch (e) {
      // console.debug("linter:", e);
    }
    if (settings.enabledAsYouTypeCompilationErrorCheck) {
      try {
        const errors: CompilerError[] =
          solcCompiler.compileSolidityDocumentAndGetDiagnosticErrors(
            filePath,
            documentText,
            settings
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

function updateSoliditySettings(
  soliditySettings: SoliditySettings<keyof compilerType>
) {
  settings = {
    ...soliditySettings,
    defaultCompiler: compilerType[soliditySettings.defaultCompiler],
    remappings: replaceRemappings(
      soliditySettings.remappings,
      process.platform === "win32"
        ? soliditySettings.remappingsWindows
        : soliditySettings.remappingsUnix
    ),
  };

  switch (linterName(settings)) {
    case "solhint": {
      linter = new SolhintService(rootPath, settings.solhintRules);
      linter.setIdeRules(linterRules(settings));
      break;
    }
    default: {
      linter = null;
    }
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
      documents.all().forEach(validate);
    } finally {
      validatingAllDocuments = false;
    }
  }
}

async function startValidation() {
  if (!settings.enabledAsYouTypeCompilationErrorCheck) {
    return validateAllDocuments();
  }

  solcCompiler.initialiseAllCompilerSettings(
    settings,
    settings.defaultCompiler
  );

  solcCompiler
    .initialiseSelectedCompiler()
    .then(() => {
      connection.console.info(
        "Validating using the compiler selected: " +
          compilerType[settings.defaultCompiler]
      );
      validateAllDocuments();
    })
    .catch((reason) => {
      connection.console.error(
        "An error has occurred initialising the compiler selected " +
          compilerType[settings.defaultCompiler] +
          ", please check your settings, reverting to the embedded compiler. Error: " +
          reason
      );
      solcCompiler.initialiseAllCompilerSettings(
        settings,
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
}

documents.onDidChangeContent((event) => {
  const document = event.document;
  if (!validatingDocument && !validatingAllDocuments) {
    validatingDocument = true; // control the flag at a higher level
    // slow down, give enough time to type (1.5 seconds?)
    setTimeout(() => validate(document), settings.validationDelay);
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
        triggerCharacters: [".", "/", '"', "'"],
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

  return result;
});

connection.onInitialized(async () => {
  updateSoliditySettings(await requestConfig());

  if (!hasWorkspaceFolderCapability) return;

  connection.workspace.onDidChangeWorkspaceFolders((_event) => {
    if (!connection.workspace) return;
    connection.workspace.onDidChangeWorkspaceFolders((event) => {
      event.removed.forEach((workspaceFolder) => {
        const index = workspaceFolders.findIndex(
          (folder) => folder.uri === workspaceFolder.uri
        );
        if (index !== -1) {
          workspaceFolders.splice(index, 1);
        }
      });

      workspaceFolders.push(...event.added);
    });
  });
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

  return new SolidityHoverProvider().provideHover(
    documents.get(handler.textDocument.uri),
    handler.position,
    getCodeWalkerService()
  );
});

type CommandParamsBase = [
  DocumentExecuteCommand & { uri: { external: string } },
  any[],
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

connection.onDidChangeConfiguration(async (change) => {
  updateSoliditySettings({
    ...defaultSoliditySettings,
    ...(await requestConfig()),
  });
});
async function requestConfig() {
  try {
    const params: ConfigurationParams = {
      items: [{ section: "solidity" }],
    };
    const [solidityConfig] = (await connection.sendRequest(
      "workspace/configuration",
      params
    )) as [SoliditySettings<keyof compilerType>];
    return solidityConfig;
  } catch (e) {
    console.log("Error getting config, using defaults..", e.message);
    return defaultSoliditySettings;
  }
}
function linterName(settings: SoliditySettings) {
  return settings.linter;
}

function linterRules(settings: SoliditySettings) {
  //   const _linterName = linterName(settings);
  return settings.solhintRules;
}

connection.listen();
