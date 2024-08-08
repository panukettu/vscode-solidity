import { Config } from "@client/client-config"
import type { CommandInfo } from "@client/client-types"
import type { DiagnosticsCollection, FileKind } from "@shared/types"
import { toURI } from "@shared/util"
import * as vscode from "vscode"
import { getClientState } from "../client-state"
import { clearAllFoundryDiagnosticScopes } from "../lens/foundry/diagnostics/foundry-diagnostics"
import { removeAllDecorations } from "../ui/decorations"
import { clearAllStatusBars } from "../ui/statusbar"
import { gasCache } from "../utils/gas"
import { CLIENT_COMMAND_LIST } from "./commands-list"

export async function openProblemsPane() {
	if (!Config.shouldOpenProblemsPane()) return
	return vscode.commands.executeCommand("workbench.actions.view.problems").then(() => {
		vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup")
	})
}

export async function sendDiagnostics(args: { diagnostics: DiagnosticsCollection; openProblems?: boolean }) {
	const state = getClientState()

	return await state.send({
		type: "diagnostics.set",
		args: { diagnostics: args.diagnostics, openProblems: args.openProblems && Config.shouldOpenProblemsPane() },
	})
}

type ClearDiagnosticArgs = {
	keepDecor?: boolean
	doc?: FileKind
}

export async function clearDiagnostics(args?: ClearDiagnosticArgs) {
	const state = getClientState()

	const uri = args?.doc ? toURI(args.doc) : undefined
	state.diagnostics.clear(uri)
	clearAllFoundryDiagnosticScopes()

	if (!args?.keepDecor) {
		removeAllDecorations(state)
		clearAllStatusBars()
		gasCache.clear()
	}

	return state.send({
		type: "diagnostics.clear",
		args: { uri: uri?.toString() },
	})
}
export default [[CLIENT_COMMAND_LIST["solidity.diagnostics.clear"], () => clearDiagnostics()]] as CommandInfo[]
