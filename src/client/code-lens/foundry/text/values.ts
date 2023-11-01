export const getKeywordValue = (line: string, words: readonly string[]) => {
	if (!line) return '';
	return words.reduce((acc, word) => {
		if (acc) return acc;
		const index = line.indexOf(word);
		if (index === -1) return acc;
		return line.slice(index + word.length).trim();
	}, '');
};

export const keywords = {
	gas: {
		test: ['gas:', 'Gas:'],
		setupFromTraces: ['::setUp()'],
	},
	traces: {
		events: {
			all: ['emit'],
		},
		sizes: ['bytes of code'],
		contract: ['new'],
		contractAddressSplitter: ['@'],
		revert: ['← "'],
		call: ['├─ ['],
	},
	logs: {
		traces: ['Traces:'],
		start: ['Logs:'],
		lastIndexBeforeUser: ['Logs:', 'Error:', 'Right:'],
		lastIndexBeforeTestLogs: ['Logs:', 'Error:'],
		end: ['Test result:'],
	},
	duration: {
		tests: ['; finished in'],
		compile: ['finished in'],
	},
	compiler: {
		error: ['Compiler error', 'Compiler run failed'],
		warnings: ['Warning', 'warning'],
		files: ['files with', 'files changed'],
		details: {
			stackTooDeep: ['too deep'],
		},
	},
	test: {
		passedCount: ['passed;'],
		failedCount: ['failed;'],
		skippedCount: ['skipped;'],
		passed: ['[PASS'],
		failed: ['[FAIL.'],
		setupFailed: ['Setup failed:'],
		details: {
			failed: ['Error:'],
			setupFailed: ['stderr=', 'evm::cheatcodes', 'forge::runner'],
		},
	},
} as const;

type LineFinder = (words: readonly string[], lastIndex?: boolean, startIndexLast?: number) => number;

export const getUserLogStartIndex = (lines: string[]) => {
	const logStartIndex = lines.findIndex((line) => line.indexOf('Logs:') !== -1);
	// const userLogStartIndex = lines.findIndex((line) => line.indexOf('Right:') !== -1);
	// there can be multiple parts where right exists..
	// so we need to find the last one

	//  this function does not work..
	// const userLogStartIndex = findLastIndex(lines, keywords.logs.lastIndexBeforeUser);
	// so we do this instead
	const userLogStartIndex = lines
		.map((line, i) => ({ line, i }))
		.filter(({ line }) => keywords.logs.lastIndexBeforeUser.some((word) => line.includes(word)))
		.pop()?.i;
	return userLogStartIndex;
};
export const getLineIndexFinder =
	(lines: string[] = []): LineFinder =>
	(words: readonly string[], lastIndex = false, startIndex = words.length) => {
		if (lastIndex) return findLastIndex(lines, words, startIndex);
		if (startIndex === words.length) return lines.findIndex((l) => words.some((w) => l.includes(w)));
		return lines.findIndex((l, i) => i > startIndex && words.some((w) => l.includes(w)));
	};

export const getLineFinder = (lines: string[]) => (words: readonly string[]) =>
	lines.find((line) => words.some((word) => line.includes(word)));

export const getLinesFinder = (lines: string[]) => (words: readonly string[]) => {
	return Array.from(new Set(lines.filter((l) => words.some((word) => l.includes(word)))));
};
function findLastIndex(lines: string[], words: readonly string[], startIndex = lines.length - 1) {
	let lastIndex = -1;
	for (let i = startIndex; i >= 0; i--) {
		if (words.some((w) => lines[i].includes(w))) {
			lastIndex = i;
			break;
		}
	}
	return lastIndex === -1 ? lines.findIndex((line) => line.includes('Logs:')) : lastIndex;
}
export const toLines = (stdout: string) =>
	stdout
		.replace(/\[\d{0,2}m/gm, '')
		.replace(/(\r\n|\n|\r)/gm, '\n')
		.split('\n');
// lines.findIndex((line) => line.includes(s) !== -1);
export const toDefaultFormat = (s: string) => {
	if (s.indexOf('Right:') !== -1) {
		return ` - ${s.trim()}\n`;
	}
	if (s.indexOf('Left:') !== -1) {
		return ` - ${s.trim()}`;
	}
	if (s.indexOf('Assertion Failed') !== -1) {
		return `\n${s.trim()}\n`;
	}
	return s.trim();
};
