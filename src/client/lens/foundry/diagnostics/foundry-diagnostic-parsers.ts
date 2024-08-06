import { getCurrentProjectInWorkspaceRootFsPath } from "@client/client-config"
import type { ClientState } from "@client/client-state"
import type { Lens, TestExec } from "@client/client-types"
import { forgeOutputErrorToDiagnostic } from "@server/providers/utils/diagnostics"
import { solcOutputRegexp } from "@shared/regexp"
import type { DiagnosticWithFileName } from "@shared/types"

export const parseOutputLabels = (lineTexts: string[] = []) =>
	lineTexts
		.map((line, index) => {
			const trimmed = line.trim()

			let split = trimmed
				.split(":")
				.map((s) => s.trim())
				.filter(Boolean)
			if (split.length < 2) {
				split = trimmed
					.split(" ")
					.map((s) => s.trim())
					.filter(Boolean)
			}

			let key = split[0]

			if (key?.indexOf("] ") !== -1) {
				key = key.split(" ")[1]
			}

			if (key.indexOf("]") !== -1) {
				key = split[1]
			}

			if (split[0] === "Error") {
				const isEqTest = lineTexts[index + 1].indexOf("==") !== -1 || lineTexts[index + 1].indexOf("!=") !== -1
				return {
					type: "Error",
					severity: 1,
					key: split[1],
					value: isEqTest
						? lineTexts
								.slice(index + 1, index + 4)
								.map((s) => s.trim())
								.join("\n")
						: lineTexts[index + 1],
				}
			}

			return {
				type: "Log",
				severity: 2,
				key,
				value: split.map((s) => s.trim()).join("\n"),
			}
		})
		.filter(Boolean)

export function parseOutputCompilerErrors(
	state: ClientState,
	args: Lens.ForgeTestExec,
	result: TestExec.Result,
	output: string,
): DiagnosticWithFileName[] {
	const regexp = solcOutputRegexp()
	const errors: DiagnosticWithFileName[] = []

	let match: string[] | null = null
	while ((match = regexp.exec(output)) !== null) {
		errors.push(forgeOutputErrorToDiagnostic(match, getCurrentProjectInWorkspaceRootFsPath()))
	}

	return errors
}
