"use strict";
import * as vscode from "vscode";
import * as path from "path";
import { Compiler } from "./client/compiler";
import {
  LanguageClientOptions,
  RevealOutputChannelOn,
} from "vscode-languageclient";
import {
  LanguageClient,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

// tslint:disable-next-line:no-duplicate-imports
import { actionSubscriptions } from "./client/subscriptions/actions";
import { baseSubscriptions } from "./client/subscriptions/base";
import { extraSubscriptions } from "./client/subscriptions/extras";

let diagnosticCollection: vscode.DiagnosticCollection;
let compiler: Compiler;

function languageServer(context: vscode.ExtensionContext): void {
  const ws = vscode.workspace.workspaceFolders;
  const serverModule = path.join(__dirname, "./server.js");
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
        "{**/remappings.txt,**/.solhint.json,**/brownie-config.yaml}"
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

export async function activate(context: vscode.ExtensionContext) {
  [compiler, diagnosticCollection] = baseSubscriptions(context);
  actionSubscriptions(context);
  extraSubscriptions(context);
  languageServer(context);
}
