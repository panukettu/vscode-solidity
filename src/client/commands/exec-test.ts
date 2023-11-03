import { Config } from "@client/client-config"
import type { ClientState } from "@client/client-state"
import { Lens } from "@client/client-types"
import { execForgeTestFunction } from "@client/lens/foundry/executors/test-executor"
import { initDecorations, lineDecoration, resetDecorations, runDecorated } from "@client/ui/decorations"
import { createStatusBarTest } from "@client/ui/statusbar"
import { ExecStatus } from "@shared/enums"
import * as vscode from "vscode"
import { CLIENT_COMMAND_LIST } from "./list"

export const commandExecTest = (state: ClientState) => async (...args: Lens.ForgeTestExec) => {
	const isTracing = Config.getTestVerbosity() > 2
	const functionName = args[0]
	if (!args.length) return
	const line = args[2].start.line

	initDecorations(state, functionName)
	const statusBar = createStatusBarTest(functionName, `${functionName}  🟡`)
	vscode.commands.executeCommand(CLIENT_COMMAND_LIST["solidity.diagnostics.clear"])
	const results = await runDecorated(
		state,
		{
			promise: execForgeTestFunction(state, args, vscode.workspace.rootPath),
			scope: functionName,
			line,
		},
		"Test running",
	)
	resetDecorations(state, functionName, ["success", "fail"])

	if (results.ui.statusBar) {
		statusBar.text = results.ui.statusBar
	}

	if (results.ui.decoration) {
		lineDecoration(state, results.ui.decoration)
	}

	const tooltip = (contracts: number, events: number, calls: number) =>
		`contracts/events/calls\n${contracts}/${events}/${calls}`
	if (results.status === ExecStatus.Pass) {
		results.ui.popup && vscode.window.showInformationMessage(results.ui.popup)
		if (isTracing && results.out.traces.contracts.length) {
			statusBar.tooltip = tooltip(
				results.out.traces.contracts.length,
				results.out.traces.events.length,
				results.out.traces.calls.user.length,
			)
		}
		return
	}
	if (results.status === ExecStatus.SetupFail) {
		results.ui.popup && vscode.window.showWarningMessage(results.ui.popup)
		if (isTracing && results.out.traces.contracts.length) {
			statusBar.tooltip = tooltip(
				results.out.traces.contracts.length,
				results.out.traces.events.length,
				results.out.traces.calls.user.length,
			)
		}
		return
	}

	if (results.status === ExecStatus.Fail) {
		results.ui.popup && vscode.window.showWarningMessage(results.ui.popup)
		if (isTracing && results.out.traces.contracts.length) {
			statusBar.tooltip = tooltip(
				results.out.traces.contracts.length,
				results.out.traces.events.length,
				results.out.traces.calls.user.length,
			)
		}
		return
	}

	if (results.status === ExecStatus.Restart) {
		results.ui.popup && vscode.window.showInformationMessage(results.ui.popup)
		return
	}

	if (results.status === ExecStatus.CompilerError) {
		results.ui.popup && vscode.window.showErrorMessage(results.ui.popup)
		return
	}

	if (results.status === ExecStatus.Error) {
		results.ui.popup && vscode.window.showErrorMessage(results.ui.popup)
		return
	}
}
