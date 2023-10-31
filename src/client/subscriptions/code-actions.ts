import type { ClientState } from '@client/client-state';
import * as vscode from 'vscode';
import { EtherscanContractDownloader } from '../../shared/external/etherscan';
import {
	AddressChecksumCodeActionProvider,
	ChangeCompilerVersionActionProvider,
	SPDXCodeActionProvider,
} from '../code-actions/fixes';

export function registerCodeActions(state: ClientState): void {
	state.context.subscriptions.push(
		vscode.commands.registerCommand('solidity.downloadVerifiedSmartContractEtherscan', async () => {
			await EtherscanContractDownloader.downloadContractWithPrompts();
		})
	);

	state.context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('solidity', new AddressChecksumCodeActionProvider(), {
			providedCodeActionKinds: AddressChecksumCodeActionProvider.providedCodeActionKinds,
		})
	);

	state.context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('solidity', new SPDXCodeActionProvider(), {
			providedCodeActionKinds: SPDXCodeActionProvider.providedCodeActionKinds,
		})
	);

	state.context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('solidity', new ChangeCompilerVersionActionProvider(), {
			providedCodeActionKinds: ChangeCompilerVersionActionProvider.providedCodeActionKinds,
		})
	);

	// state.context.subscriptions.push;
	// vscode.commands.registerCommand('solidity.fixDocument', () => {
	// 	fix();
	// });
}
