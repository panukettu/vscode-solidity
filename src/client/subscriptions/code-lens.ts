import { ClientState } from '@client/client-state';
import { Lens } from '@client/code-lens/code-lens-types';
import { clearAllFoundryDiagnosticScopes } from '@client/code-lens/foundry/diagnostics/foundry-diagnostics';
import { execForgeTestFunction } from '@client/code-lens/foundry/executors/test-executor';
import { Config } from '@shared/config';
import { ExecStatus } from '@shared/enums';
import * as vscode from 'vscode';
import { CodelensProvider } from '../code-lens/code-lenses';
import { initDecorations, lineDecoration, removeAllDecorations, resetDecorations, runDecorated } from '../decorations';
const statusBars: vscode.StatusBarItem[] = [];

export const clearAllStatusBars = () => {
	statusBars.forEach((statusBar) => statusBar.dispose());
};
export function registerCodeLenses(state: ClientState): void {
	const codeLens = new CodelensProvider();
	state.context.subscriptions.push(
		vscode.languages.registerCodeLensProvider({ language: 'solidity', scheme: 'file' }, codeLens)
	);

	state.context.subscriptions.push(
		...registerCodeLensCommands(state),
		vscode.workspace.onDidSaveTextDocument(async (e) => {
			if (e.languageId === 'solidity' && e.fileName.endsWith('.t.sol')) {
				const isEnabled = vscode.workspace.getConfiguration('solidity').get('executeTestFunctionOnSave', true);
				if (!isEnabled) return;

				const position = vscode.window.activeTextEditor?.selection.active;
				if (!position) return;

				const lens = codeLens.getCodeLensFromPosition('solidity.lens.function.test', position);
				if (!lens || !lens.command?.arguments?.length) return;

				vscode.commands.executeCommand(lens.command.command, ...lens.command.arguments);
			}
		})
	);
}

const registerCodeLensCommands = (state: ClientState) => [
	vscode.commands.registerCommand('solidity.lens.test.info', async (...args: Lens.ForgeTestExec) => {
		const functionName = args[0];
		const statusBar = vscode.window.createStatusBarItem(args[0], vscode.StatusBarAlignment.Left, -1);
		statusBars.push(statusBar);
		statusBar.show();
		statusBar.name = 'vsc-solidity';
		statusBar.text = 'Preparing data.. 🟡';
		initDecorations(state, functionName);
		state.compilers.outputChannel.clear();
		state.compilers.outputChannel.show();
		state.compilers.outputChannel.appendLine('*** Preparing data..');
		try {
			const results = await execForgeTestFunction(state, args, vscode.workspace.rootPath, true);

			if (results.status === ExecStatus.Pass || results.status === ExecStatus.Fail) {
				statusBar.text = 'Printing... 🟢';
				state.compilers.outputChannel.appendLine(`*** Printing data for ${functionName}()`);

				const contractCount = results.out.traces.contracts?.length;
				const eventCount = results.out.traces.events?.length;
				const callCount = results.out.traces.calls?.length;

				if (!contractCount) {
					state.compilers.outputChannel.appendLine(`No contracts deployed during ${functionName}().`);
				} else {
					state.compilers.outputChannel.appendLine(JSON.stringify(results.out.traces.contracts, null, 2));
					state.compilers.outputChannel.appendLine(`Total contracts deployed during ${functionName}():`);
					try {
						state.compilers.outputChannel.appendLine(
							`Total size of contracts in bytes: ${results.out.traces.contracts.reduce((a, b) => {
								return a + Number(b.size.replace(/\D/g, ''));
							}, 0)} bytes`
						);
						const smallest = results.out.traces.contracts.reduce((a, b) => {
							return Number(a.size.replace(/\D/g, '')) < Number(b.size.replace(/\D/g, '')) ? a : b;
						});
						const bigggest = results.out.traces.contracts.reduce((a, b) => {
							return Number(a.size.replace(/\D/g, '')) > Number(b.size.replace(/\D/g, '')) ? a : b;
						});
						state.compilers.outputChannel.appendLine(`- Smallest contract: ${smallest.name} (${smallest.size})`);
						state.compilers.outputChannel.appendLine(`- Biggest contract: ${bigggest.name} (${bigggest.size})`);
					} catch (e) {
						console.debug(e);
						state.compilers.outputChannel.appendLine('*** Could not calculate total size of contracts.');
					}
				}

				if (!eventCount) {
					state.compilers.outputChannel.appendLine(`No events emitted during ${functionName}().`);
				} else {
					state.compilers.outputChannel.appendLine(`Total events emitted during ${functionName}(): ${eventCount}`);
				}

				if (!results.out.traces.calls.length) {
					state.compilers.outputChannel.appendLine(`No calls made in ${functionName}().`);
				} else {
					state.compilers.outputChannel.appendLine(`Total calls made during ${functionName}(): ${callCount}`);
				}

				state.compilers.outputChannel.appendLine("*** Finished! Use 'solidity.lens.function.test' to run the function");
				state.compilers.outputChannel.appendLine(`*** Took ${results.out.infos.testDuration} to complete.`);
				statusBar.text = `📑  ${contractCount}  |  📡 ${eventCount}  |  📳 ${callCount}`;
				statusBar.tooltip = 'Contracts | Events | Calls';
			}
		} catch (e) {
			state.compilers.outputChannel.appendLine(`*** Could not print data. Error: ${e.message}`);
		}
	}),
	vscode.commands.registerCommand(
		'solidity.lens.function.selector',
		async (...args: [vscode.TextDocument, vscode.Range]) => {
			const result: string = await vscode.commands.executeCommand('solidity.server.lens.function.selector', ...args);

			return vscode.window.showInformationMessage(result);
		}
	),
	vscode.commands.registerCommand(
		'solidity.lens.function.natspec',
		async (...args: [vscode.TextDocument, vscode.Range]) => {
			const result: string = await vscode.commands.executeCommand('solidity.server.lens.function.natspec', ...args);
			return vscode.window.activeTextEditor.edit((editBuilder) => {
				const position = new vscode.Position(args[1].start.line, 0);
				editBuilder.insert(position, result);
			});
		}
	),
	vscode.commands.registerCommand('solidity.lens.diagnostics.clear', async () => {
		state.diagnostics.clear();
		clearAllFoundryDiagnosticScopes(state);
		removeAllDecorations(state);
		clearAllStatusBars();
	}),
	vscode.commands.registerCommand('solidity.lens.function.test', async (...args: Lens.ForgeTestExec) => {
		const isTracing = Config.getTestVerbosity() > 2;
		const functionName = args[0];
		const line = args[2].start.line;
		const statusBar = vscode.window.createStatusBarItem(functionName, vscode.StatusBarAlignment.Left, -1);
		statusBars.push(statusBar);

		statusBar.show();
		statusBar.name = 'vsc-solidity-test';
		statusBar.text = `${functionName}  🟡`;
		initDecorations(state, functionName);

		const runArgs = {
			promise: execForgeTestFunction(state, args, vscode.workspace.rootPath),
			scope: functionName,
			line,
		};

		const results = await runDecorated(state, runArgs, 'Test running');
		resetDecorations(state, functionName, ['success', 'fail']);

		if (results.ui.statusBar) {
			statusBar.text = results.ui.statusBar;
		}

		if (results.ui.decoration) {
			lineDecoration(state, results.ui.decoration);
		}

		if (results.status === ExecStatus.Pass) {
			results.ui.popup && vscode.window.showInformationMessage(results.ui.popup);
			if (isTracing && results.out.traces.contracts.length) {
				statusBar.tooltip = `contracts/events/calls\n${results.out.traces.contracts.length}/${results.out.traces.events.length}/${results.out.traces.calls.length}`;
			}
			return;
		}
		if (results.status === ExecStatus.SetupFail) {
			results.ui.popup && vscode.window.showWarningMessage(results.ui.popup);
			if (isTracing && results.out.traces.contracts.length) {
				statusBar.tooltip = `contracts/events/calls\n${results.out.traces.contracts.length}/${results.out.traces.events.length}/${results.out.traces.calls.length}`;
			}
			return;
		}

		if (results.status === ExecStatus.Fail) {
			results.ui.popup && vscode.window.showWarningMessage(results.ui.popup);
			if (isTracing && results.out.traces.contracts.length) {
				statusBar.tooltip = `contracts/events/calls\n${results.out.traces.contracts.length}/${results.out.traces.events.length}/${results.out.traces.calls.length}`;
			}
			return;
		}

		if (results.status === ExecStatus.Restart) {
			results.ui.popup && vscode.window.showInformationMessage(results.ui.popup);
			return;
		}

		if (results.status === ExecStatus.CompilerError) {
			results.ui.popup && vscode.window.showErrorMessage(results.ui.popup);
			return;
		}

		if (results.status === ExecStatus.Error) {
			results.ui.popup && vscode.window.showErrorMessage(results.ui.popup);
			return;
		}
	}),
	vscode.commands.registerCommand('solidity.lens.string.keccak256', async (...args) => {
		const result: string = await vscode.commands.executeCommand('solidity.server.lens.string.keccak256', ...args);

		return vscode.window.showInformationMessage(result);
	}),
];
