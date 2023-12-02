import { Config } from "@client/client-config"
import type { ClientState } from "@client/client-state"
import { Lens } from "@client/client-types"
import { execForgeTestFunction } from "@client/lens/foundry/executors/test-executor"
import {
	initDecorations,
	lineDecoration,
	removeAllDecorations,
	resetDecorations,
	runDecorated,
} from "@client/ui/decorations"
import { clearAllStatusBars, createStatusBarTest } from "@client/ui/statusbar"
import { ExecStatus } from "@shared/enums"
import * as vscode from "vscode"
import { CLIENT_COMMAND_LIST } from "./commands"

// Executes the test function command
export const commandExecTest = (state: ClientState) => async (...args: Lens.ForgeTestExec) => {
	const isTracing = Config.getTestVerbosity() > 2
	const [functionName, document] = args
	if (!args.length) return
	const line = args[2].start.line
	clearAllStatusBars()
	removeAllDecorations(state)

	initDecorations(state, functionName)
	const statusBar = createStatusBarTest(functionName, `${functionName}  🟡`)

	/* ------------------------------------------------------------------------- */
	/*                                    run                                    */
	/* ------------------------------------------------------------------------- */
	const results = await runDecorated(
		document,
		state,
		{
			promise: execForgeTestFunction(state, args, vscode.workspace.rootPath),
			scope: functionName,
			line,
		},
		"Test running",
	)

	/* ------------------------------------------------------------------------- */
	/*                                  results                                  */
	/* ------------------------------------------------------------------------- */

	resetDecorations(state, functionName, ["success", "fail"])

	if (results.ui.statusBar) {
		statusBar.text = results.ui.statusBar
	}

	if (results.ui.decoration) {
		lineDecoration(
			state,
			results.ui.decoration,
			document,
			document.uri.fsPath !== vscode.window.activeTextEditor.document.uri.fsPath,
		)
	}

	const tooltip = (contracts: number, events: number, calls: number) =>
		`contracts/events/calls\n${contracts}/${events}/${calls}`

	/* --------------------------------- pass --------------------------------- */
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

	/* ------------------------------- setup fail ------------------------------ */
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

	/* ---------------------------------- fail --------------------------------- */
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
	/* ----------------------------- errors/restart ---------------------------- */
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
