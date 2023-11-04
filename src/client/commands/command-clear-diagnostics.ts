import type { ClientState } from "@client/client-state"
import { clearAllFoundryDiagnosticScopes } from "@client/lens/foundry/diagnostics/foundry-diagnostics"
import { removeAllDecorations } from "@client/ui/decorations"
import { clearAllStatusBars } from "@client/ui/statusbar"
import { gasCache } from "@client/utils/gas"
import { SERVER_COMMANDS_LIST } from "@shared/server-commands"
import * as vscode from "vscode"

export const commandClearDiagnostics =
	(state: ClientState) => async (...args: [boolean, vscode.TextDocument, ...any[]]) => {
		state.diagnostics.default.clear()
		clearAllFoundryDiagnosticScopes(state)
		if (!args[0]) {
			removeAllDecorations(state)
			clearAllStatusBars()
			gasCache.clear()
		}
		await vscode.commands.executeCommand(SERVER_COMMANDS_LIST["diagnostic.clear"], args[1])
	}
