import type { ExecFileException } from "node:child_process"
import type { ExecStatus } from "@shared/enums"
import type { FunctionName } from "@shared/types"
import type * as vscode from "vscode"
import type { ClientState } from "./client-state"
import type { CLIENT_COMMAND_LIST } from "./commands/commands-list"
import type { ParsedLogs } from "./lens/foundry/foundry-logs-parser"

type ClientCommand = keyof typeof CLIENT_COMMAND_LIST
export type CommandInfo = readonly [ClientCommand, (...args: any[]) => any]
export namespace Lens {
	export type Funcsig = readonly [vscode.TextDocument, vscode.Range]
	export type Natspec = readonly [vscode.TextDocument, vscode.Range]
	export type ForgeTestExec = readonly [FunctionName, vscode.TextDocument, vscode.Range]
}
export type BaseCommandArgs = readonly [vscode.TextDocument, vscode.Range]
export type ParseStdOutArgs<T, R = T, U = T> = {
	process: ProcessOut
	args: readonly [string, ...any[]]
	scope?: string
	onUnhandled: (parsed: TestExec.Unhandled, stdout: string, error: ExecFileException) => U
	onCompilerError: (parsed: TestExec.Result, stdout: string, error: ExecFileException) => T
	onPass: (parsed: TestExec.Result, stdout: string) => T
	onSetupFail: (parsed: TestExec.Result, stdout: string) => T
	onFail: (parsed: TestExec.Result, stdout: string) => T
	onRestart: (parsed: TestExec.Restart, stdout: string) => R
}

export type ProcessOut = {
	stdout: string
	stderr: string
	error?: ExecFileException
}
export namespace TestExec {
	export type UI = {
		statusBar?: string
		decoration?: DecorArgs
		popup?: string
	}

	export type Restart = {
		status: ExecStatus.Restart
		ui?: UI
		out?: {
			lines: string[]
		}
		error?: ExecFileException
	}
	export type Unhandled = {
		status: ExecStatus.Error
		ui?: UI
		out?: Partial<TestOutputs>
		error?: ExecFileException
	}
	export type Result = {
		status: ExecStatus.CompilerError | ExecStatus.Fail | ExecStatus.Pass | ExecStatus.SetupFail
		ui?: UI
		out: TestOutputs
		error?: ExecFileException
	}
}
export type TestOutputs = {
	lines: string[]
	summary: string[]
	details: string[]
} & ParsedLogs

export type ForgeTestJson<T extends string = ""> = {
	duration: {
		secs: number
		nanos: number
	}
	test_results: {
		[key in FunctionName<T>]: {
			status: "Failure" | "Success"
			logs: any[]
			decoded_logs: string[]
			kind: {
				Standard: number
				traces: any[]
				labeled_addresses: object
				debug: any
				breakpoints: any
				warnings: any[]
			}
		}
	}
}

export type DecorationScope = {
	pending: vscode.TextEditorDecorationType
	fail: vscode.TextEditorDecorationType
	success: vscode.TextEditorDecorationType
}

export type DecorArgs = {
	scope: string
	text: string
	line: number
	type: "pending" | "fail" | "success"
}
