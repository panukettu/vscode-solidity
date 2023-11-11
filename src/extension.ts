// import 'tsconfig-paths/register';
import { setupClientState } from "@client/client-state"
import { registerCodeActions } from "@client/context/register-code-actions"
import { registerCodeLenses } from "@client/context/register-code-lens"
import { registerConfigSetters } from "@client/context/register-config-setters"
import { registerDocumentProviders } from "@client/context/register-document-providers"
import { registerSolcCommands } from "@client/context/register-solc-commands"
import * as path from "path"
import * as vscode from "vscode"
import { RevealOutputChannelOn, type LanguageClientOptions } from "vscode-languageclient"
import { LanguageClient, TransportKind, type ServerOptions } from "vscode-languageclient/node"

function server(context: vscode.ExtensionContext): LanguageClient {
	const serverModule = path.join(__dirname, "./server.js")
	const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] }
	const serverOptions: ServerOptions = {
		run: {
			module: serverModule,
			transport: TransportKind.ipc,
		},
		debug: {
			args: ["--debug"],
			module: serverModule,
			options: debugOptions,
			transport: TransportKind.ipc,
		},
	}

	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ language: "solidity", scheme: "file" },
			{ language: "solidity", scheme: "untitled" },
		],
		revealOutputChannelOn: RevealOutputChannelOn.Never,
		workspaceFolder: vscode.workspace.workspaceFolders[0],
		synchronize: {
			// Synchronize the setting section 'solidity' to the server
			configurationSection: "solidity",

			// Notify the server about file changes to '.sol.js files contain in the workspace (TODO node, linter)
			fileEvents: [
				vscode.workspace.createFileSystemWatcher(
					new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], "foundry.toml"),
				),
				vscode.workspace.createFileSystemWatcher(
					new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], "hardhat.config.js"),
				),
			],
		},
		initializationOptions: {
			codeActionLiteralSupport: true,
			solcCachePath: context.extensionPath,
		},
	}

	const client = new LanguageClient("solidity", "Solidity Language Server", serverOptions, clientOptions)
	client.start()
	// Push the disposable to the context's subscriptions so that the
	// client can be deactivated on extension deactivation
	context.subscriptions.push(client)
	return client
}

export function activate(context: vscode.ExtensionContext) {
	const state = setupClientState(context)
	state.client = server(context)

	registerDocumentProviders(state)
	registerSolcCommands(state)
	registerConfigSetters(state)
	registerCodeActions(state)
	registerCodeLenses(state)
}
