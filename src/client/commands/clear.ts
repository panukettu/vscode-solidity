import type { ClientState } from "@client/client-state"
import { clearAllFoundryDiagnosticScopes } from "@client/lens/foundry/diagnostics/foundry-diagnostics"
import { removeAllDecorations } from "@client/ui/decorations"
import { clearAllStatusBars } from "@client/ui/statusbar"

export const commandClearDiagnostics = (state: ClientState) => async () => {
	state.diagnostics.clear()
	clearAllFoundryDiagnosticScopes(state)
	removeAllDecorations(state)
	clearAllStatusBars()
}
