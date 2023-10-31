// import 'tsconfig-paths/register';
import { setupClientState } from '@client/client-state';
import { registerCodeActions } from '@client/subscriptions/code-actions';
import { registerCodeLenses } from '@client/subscriptions/code-lens';
import { registerConfigSetters } from '@client/subscriptions/config-setters';
import { registerDocumentProviders } from '@client/subscriptions/document-providers';
import { registerSolcCommands } from '@client/subscriptions/solc-commands';
import * as path from 'path';
import * as vscode from 'vscode';
import { RevealOutputChannelOn, type LanguageClientOptions } from 'vscode-languageclient';
import { LanguageClient, TransportKind, type ServerOptions } from 'vscode-languageclient/node';

function server(context: vscode.ExtensionContext): LanguageClient {
	const serverModule = path.join(__dirname, './server.js');
	const serverOptions: ServerOptions = {
		debug: {
			module: serverModule,
			options: {
				execArgv: ['--nolazy', '--inspect=6009'],
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
			{ language: 'solidity', scheme: 'file' },
			{ language: 'solidity', scheme: 'untitled' },
		],
		revealOutputChannelOn: RevealOutputChannelOn.Never,
		synchronize: {
			// Synchronize the setting section 'solidity' to the server
			configurationSection: 'solidity',
			// Notify the server about file changes to '.sol.js files contain in the workspace (TODO node, linter)
			fileEvents: [
				vscode.workspace.createFileSystemWatcher(
					new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], 'foundry.toml')
				),
				vscode.workspace.createFileSystemWatcher(
					new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], 'hardhat.config.js')
				),
			],
		},
		initializationOptions: {
			solcCachePath: context.extensionPath,
		},
	};

	const client = new LanguageClient('solidity', 'Solidity Language Server', serverOptions, clientOptions);
	client.start();
	// Push the disposable to the context's subscriptions so that the
	// client can be deactivated on extension deactivation
	context.subscriptions.push(client);
	return client;
}

export function activate(context: vscode.ExtensionContext) {
	const state = setupClientState(context);
	state.client = server(context);

	registerDocumentProviders(state);
	registerSolcCommands(state);
	registerConfigSetters(state);
	registerCodeActions(state);
	registerCodeLenses(state);
}
