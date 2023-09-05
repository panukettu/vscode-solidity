"use strict";
import * as path from "path";
import * as vscode from "vscode";
import { compileAllContracts } from "./client/compileAll";
import { Compiler } from "./client/compiler";
import {
  compileActiveContract,
  initDiagnosticCollection,
} from "./client/compileActive";

import {
  LanguageClientOptions,
  RevealOutputChannelOn,
} from "vscode-languageclient";
import {
  LanguageClient,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import { lintAndfixCurrentDocument } from "./server/linter/soliumClientFixer";
// tslint:disable-next-line:no-duplicate-imports
import { workspace, WorkspaceFolder } from "vscode";
import { formatDocument } from "./client/formatter/formatter";
import { compilerType } from "./common/solcCompiler";
import * as workspaceUtil from "./client/workspaceUtil";
import {
  AddressChecksumCodeActionProvider,
  ChangeCompilerVersionActionProvider,
  SPDXCodeActionProvider,
} from "./client/codeActionProviders/addressChecksumActionProvider";
import { EtherscanContractDownloader } from "./common/sourceCodeDownloader/etherscanSourceCodeDownloader";

let diagnosticCollection: vscode.DiagnosticCollection;
let compiler: Compiler;

export async function activate(context: vscode.ExtensionContext) {
  const ws = workspace.workspaceFolders;
  diagnosticCollection =
    vscode.languages.createDiagnosticCollection("solidity");
  compiler = new Compiler(context.extensionPath);

  context.subscriptions.push(diagnosticCollection);

  initDiagnosticCollection(diagnosticCollection);

  context.subscriptions.push(
    vscode.commands.registerCommand("solidity.compile.active", async () => {
      const compiledResults = await compileActiveContract(compiler);
      return compiledResults;
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solidity.compile.activeUsingRemote",
      async () => {
        const compiledResults = await compileActiveContract(
          compiler,
          compilerType.remote
        );
        return compiledResults;
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solidity.compile.activeUsingLocalFile",
      async () => {
        const compiledResults = await compileActiveContract(
          compiler,
          compilerType.localFile
        );
        return compiledResults;
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solidity.compile.activeUsingNodeModule",
      async () => {
        const compiledResults = await compileActiveContract(
          compiler,
          compilerType.localNodeModule
        );
        return compiledResults;
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("solidity.compile", () => {
      compileAllContracts(compiler, diagnosticCollection);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("solidity.fixDocument", () => {
      lintAndfixCurrentDocument();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("solidity.compilerInfo", async () => {
      await compiler.outputCompilerInfoEnsuringInitialised();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("solidity.solcReleases", async () => {
      compiler.outputSolcReleases();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solidity.selectWorkspaceRemoteSolcVersion",
      async () => {
        compiler.selectRemoteVersion(vscode.ConfigurationTarget.Workspace);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solidity.downloadRemoteSolcVersion",
      async () => {
        const root = workspaceUtil.getCurrentWorkspaceRootFolder();
        compiler.downloadRemoteVersion(root.uri.fsPath);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solidity.downloadVerifiedSmartContractEtherscan",
      async () => {
        await EtherscanContractDownloader.downloadContractWithPrompts();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solidity.downloadRemoteVersionAndSetLocalPathSetting",
      async () => {
        const root = workspaceUtil.getCurrentWorkspaceRootFolder();
        compiler.downloadRemoteVersionAndSetLocalPathSetting(
          vscode.ConfigurationTarget.Workspace,
          root.uri.fsPath
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solidity.selectGlobalRemoteSolcVersion",
      async () => {
        compiler.selectRemoteVersion(vscode.ConfigurationTarget.Global);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solidity.changeDefaultCompilerType",
      async () => {
        compiler.changeDefaultCompilerType(
          vscode.ConfigurationTarget.Workspace
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider("solidity", {
      async provideDocumentFormattingEdits(
        document: vscode.TextDocument
      ): Promise<vscode.TextEdit[]> {
        return formatDocument(document, context);
      },
    })
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "solidity",
      new AddressChecksumCodeActionProvider(),
      {
        providedCodeActionKinds:
          AddressChecksumCodeActionProvider.providedCodeActionKinds,
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "solidity",
      new SPDXCodeActionProvider(),
      {
        providedCodeActionKinds: SPDXCodeActionProvider.providedCodeActionKinds,
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "solidity",
      new ChangeCompilerVersionActionProvider(),
      {
        providedCodeActionKinds:
          ChangeCompilerVersionActionProvider.providedCodeActionKinds,
      }
    )
  );

  const serverModule = path.join(__dirname, "server.js");
  const serverOptions: ServerOptions = {
    debug: {
      module: serverModule,
      options: {
        execArgv: ["--nolazy", "--inspect=6009"],
      },
      transport: TransportKind.ipc,
    },
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: "solidity", scheme: "file" },
      { language: "solidity", scheme: "untitled" },
    ],
    revealOutputChannelOn: RevealOutputChannelOn.Never,
    synchronize: {
      // Synchronize the setting section 'solidity' to the server
      configurationSection: "solidity",
      // Notify the server about file changes to '.sol.js files contain in the workspace (TODO node, linter)
      fileEvents: vscode.workspace.createFileSystemWatcher(
        "{**/remappings.txt,**/.solhint.json,**/.soliumrc.json,**/brownie-config.yaml}"
      ),
    },
    initializationOptions: context.extensionPath,
  };

  let clientDisposable;

  if (ws) {
    clientDisposable = new LanguageClient(
      "solidity",
      "Solidity Language Server",
      serverOptions,
      clientOptions
    ).start();
  }
  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(clientDisposable);
}
