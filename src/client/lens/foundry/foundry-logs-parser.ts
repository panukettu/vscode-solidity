import { Config } from "@client/client-config"
export type ParsedLogs = {
	infos: ReturnType<typeof getInfos>
	traces: ReturnType<typeof getTraces>
	logs: ReturnType<typeof getLogs>
}
/* -------------------------------------------------------------------------- */
/*                                   general                                  */
/* -------------------------------------------------------------------------- */

const getInfos = (lines: string[], functionName: string) => {
	const getLine = getLineFinder(lines)
	const getLines = getLinesFinder(lines)

	const compileDuration = getLine(keywords.duration.compile)
	const gasSpent = getKeywordValue(getLine(keywords.gas.test), keywords.gas.test).replace(")", "")

	const summary = getLine(keywords.test.summary)
	const fullFunctionName = summary?.length ? summary.split("(gas:")[0].split("]")[1].trim() : functionName
	return {
		summary,
		fullFunctionName: fullFunctionName,
		gasSpent: Number.isNaN(+gasSpent) ? 0 : +gasSpent,
		reason: getKeywordValue(getLine(keywords.test.failed), ["Reason:"])?.trim().split("]")[0],
		testDuration: getKeywordValue(getLine(keywords.duration.tests), keywords.duration.tests),
		compileDuration:
			!compileDuration?.includes("Test") && !compileDuration?.includes("passed") ? compileDuration : undefined,
		compileInfo: getLine(keywords.compiler.files)?.replace("Compiling", "Compiled"),
		stackTooDeep: getLine(keywords.compiler.details?.stackTooDeep),
		errors: getLines(keywords.compiler.error),
		warnings: getLines(keywords.compiler.warnings),
	}
}
/* -------------------------------------------------------------------------- */
/*                                   tracing                                  */
/* -------------------------------------------------------------------------- */

const getTraces = (lines: string[]) => {
	const getIndex = getLineIndexFinder(lines)
	const getLines = getLinesFinder(lines)
	const traces = {
		events: [],
		contracts: [],
		calls: {
			vm: [],
			user: [],
		},
		summaryText: "",
	}
	const isTracing = Config.getTestVerbosity() > 2
	if (!isTracing) return traces

	try {
		traces.events = getLines(keywords.traces.events.all)
		traces.contracts = getLines(keywords.traces.contract).map((line) => {
			try {
				const sizeSearchStartIndex = lines.indexOf(line) - 1
				const sizesIndex = getIndex(keywords.traces.sizes, false, sizeSearchStartIndex)
				const sizeText =
					sizesIndex !== -1
						? lines[sizesIndex].split(String(keywords.traces.sizes))[0].trim().concat("##bytes")
						: "size not found"
				const addresses = line
					.split(String(keywords.traces.contract))[1]
					.trim()
					.split(String(keywords.traces.contractAddressSplitter))
				const size = sizeText.split(" ")
				return {
					name: addresses[0],
					address: addresses[1],
					size: size[size?.length - 1].replace("##", " "),
				}
			} catch {
				return {
					name: "failed",
					address: "failed",
					size: "failed",
				}
			}
		})
		const calls = getLines(keywords.traces.call)
		const vmCalls = calls.filter((l) => l.includes("VM::"))
		const userCalls = calls.filter((l) => !l.includes("VM::"))
		traces.calls = {
			vm: vmCalls,
			user: userCalls,
		}
		const vmCallText = vmCalls.length > 0 ? `(+${vmCalls.length} vm)` : ""
		traces.summaryText = `\n-- trace\n${traces.contracts?.length} contracts created\n${traces.events?.length} events emitted\n${traces.calls.user?.length} calls ${vmCallText}\n`
	} catch {}

	return traces
}

/* -------------------------------------------------------------------------- */
/*                                 actual logs                                */
/* -------------------------------------------------------------------------- */

const getLogs = (lines: string[]) => {
	const getIndex = getLineIndexFinder(lines)
	const logStartIndex = getIndex(keywords.logs.start)
	const logEndIndex = getIndex(keywords.logs.end)

	const all = lines.slice(logStartIndex, logEndIndex - 1)

	return {
		formatted: ["-- output"].concat([...all.slice(1), " "]),
		all,
	}
}

export default {
	getInfos,
	getTraces,
	getLogs,
}

/* -------------------------------------------------------------------------- */
/*                                    utils                                   */
/* -------------------------------------------------------------------------- */

export const getKeywordValue = (line: string, words: readonly string[]) => {
	if (!line) return ""
	return words.reduce((acc, word) => {
		if (acc) return acc
		const index = line.indexOf(word)
		if (index === -1) return acc
		return line.slice(index + word.length).trim()
	}, "")
}

export const keywords = {
	gas: {
		test: ["gas:", "Gas:"],
		setupFromTraces: ["::setUp()"],
	},
	traces: {
		events: {
			all: ["emit"],
		},
		sizes: ["bytes of code"],
		contract: ["new"],
		contractAddressSplitter: ["@"],
		revert: ['← "'],
		call: ["├─ ["],
	},
	logs: {
		traces: ["Traces:"],
		start: ["Logs:"],
		end: ["Traces:", "Test result:"],
	},
	duration: {
		tests: ["; finished in"],
		compile: ["finished in"],
	},
	compiler: {
		error: ["Compiler error", "Compiler run failed"],
		warnings: ["Warning", "warning"],
		files: ["files with", "files changed"],
		details: {
			stackTooDeep: ["too deep"],
		},
	},
	test: {
		summary: ["[PASS", "[FAIL"],
		passedCount: ["passed;"],
		failedCount: ["failed;"],
		skippedCount: ["skipped;"],
		passed: ["[PASS"],
		failed: ["[FAIL."],
		setupFailed: ["Setup failed:"],
		details: {
			failed: ["Error:"],
			setupFailed: ["stderr=", "evm::cheatcodes", "forge::runner"],
		},
	},
} as const

type LineFinder = (words: readonly string[], lastIndex?: boolean, startIndexLast?: number) => number

export const getLineIndexFinder =
	(lines: string[] = []): LineFinder =>
	(words: readonly string[], lastIndex = false, startIndex = words.length) => {
		if (lastIndex) return findLastIndex(lines, words, startIndex)
		if (startIndex === words.length) return lines.findIndex((l) => words.some((w) => l.includes(w)))
		return lines.findIndex((l, i) => i > startIndex && words.some((w) => l.includes(w)))
	}

export const getLineFinder = (lines: string[]) => (words: readonly string[]) =>
	lines.find((line) => words.some((word) => line.includes(word)))

export const getLinesFinder = (lines: string[]) => (words: readonly string[]) => {
	return Array.from(new Set(lines.filter((l) => words.some((word) => l.includes(word)))))
}

function findLastIndex(lines: string[], words: readonly string[], startIndex = lines.length - 1) {
	let lastIndex = -1
	for (let i = startIndex; i >= 0; i--) {
		if (words.some((w) => lines[i].includes(w))) {
			lastIndex = i
			break
		}
	}
	return lastIndex === -1 ? lines.findIndex((line) => line.includes("Logs:")) : lastIndex
}
export const toLines = (stdout: string) =>
	stdout
		.replace(/\[\d{0,2}m/gm, "")
		.replace(/(\r\n|\n|\r)/gm, "\n")
		.split("\n")
// lines.findIndex((line) => line.includes(s) !== -1);
export const toDefaultFormat = (s: string) => {
	if (s.indexOf("Right") !== -1) {
		return ` - ${s.trim()}\n`
	}
	if (s.indexOf("Left") !== -1) {
		return ` - ${s.trim()}`
	}
	if (s.indexOf("Assertion Failed") !== -1) {
		return `\n${s.trim()}\n`
	}
	return s.trim()
}
