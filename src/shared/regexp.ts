// const backup1 = () => /Error \((\d+)\): (.+)\n.*?\S+.(.+):(\d+):(\d+)/gm;
// export const backup2 = () =>
// 	/(error|Error |Note|Warning)(?:.\s|\s?)(\((.*?)\))?:\s?(.*?)\n.*-->\W+(.*?):(\d+):(\d+):.*?\n.*?\n.*?\S+\s+(?=\w)(.*?(?=\W))\n/g;
// const functionRegexp = () => new RegExp(/(function.*?\()/g);

export const solcErrorRegexp = () => /Error.*?\((\d+)\).*?:.*?(.+)\n.*?\S+.(.+):(\d+):(\d+)/gm

export const solcOutputRegexp = () =>
	/(error|Error |Note|Warning)(?:.\s|\s?)(\((.*?)\))?:\s?(.*?)\n.*-->\W+(.*?):(\d+):(\d+):.*?\n.*?\n.*?\S+\s+(?=\w)(.*?(?=\W))\n|(Error) \((\d+)\): (.+)\n.*?\S+.(.+):(\d+):(\d+)/g

export const formatOutput = (stdout: string) =>
	stdout
		.replaceAll(/\[\d{0,2}m/g, "")
		// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
		.replaceAll(/(\x1B\d{0,2}?|\[\d;\d{2}\w)/g, "")
		// .replaceAll(/(\\x9B|\\x1B\[)[0-?]*[ -\/]*[@-~]/gm, '')
		.replaceAll(/(\r\n|\n|\r)/g, "\n")

export const functionRegexp = () => new RegExp(/function (\w+).*?\n(.+?)\}/gs)
export const testFunctionRegexp = () => /function (test.*?)\(/g

export const regex2 = (name: string) => new RegExp(`@param\\s${name}\\s(\.*\\w)`, "g")
export const regexNamed = (name: string) => new RegExp(`@return\\s${name}\\s(\.*\\w)`, "g")
export const regexUnnamed = (name: string) => new RegExp("@return\\s+(.+\\w)", "g")

export const existingFuncRegexp = new RegExp(/(.*?\(.*?\))/s)
export const innerImportRegexp = new RegExp(/(import\s\{)/s)
export const emitRegexp = new RegExp(/(emit\s)/s)
export const importRegexp = new RegExp(/(import\s)(?!\{)/s)
export const fromRegexp = new RegExp(/(import\s\{.*?\}\sfrom)/s)
export const importFullRegexp = new RegExp(/import\s*({(?<symbols>.*?)}\s*from\s*)?["'](?<from>.*?)["']/, "gm")
export const symbolIdRegexp = new RegExp(/import\s\{(.*?)\W/s)

export const emitDotRegexp = /emit\s(\w+)\./g

export const mappingIdRegexp = /(\w+)(?=\[)/g
export const itemIdRegexp = /(\w+)(?=\()/g
export const isReplacingCallRegexp = new RegExp(/(.*?\(.*?\))/s)
export const mappingIdsRegexpOld = /([a-zA-Z0-9_()]+)\[([^\]]*)\](?:\[([^\]]*)\])*(?!\.)(?=\;?$)/s

export const dotStartWordsRegexp = /(\w+)(?=\()/g
export const mappingStartWordsREgexp = /(\w+)(?=\[)/g
export const mappingWordsRegexp = /([a-zA-Z0-9_()]+)\[([^\]]*)\](?:\[([^\]]*)\])*(?!\.)(?=\;?$)/s

export const keccak256Regexp = () => new RegExp(/(?<=keccak256\(")(.*?)(?="\))/g)

export const nameRegexp = new RegExp(/(?<=\W)(\w+)(?=\()/gs)

export const commentFormatRegexp = new RegExp(/\s(\w.+)/, "s")
