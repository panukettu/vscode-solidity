import type { DocUtil } from "@server/utils/text-document"
import * as vscode from "vscode-languageserver/node"
import { globalNames } from "./utils/completion/globals"

export const tokenTypes = [
	"function",
	"struct",
	"parameter",
	"constant",
	"property",
	"interface",
	"library",
	"modifier",
	"variable",
	"using",
	"error",
	"constant",
	"event",
	"contract",
]
export const tokenModifiers = [
	"declaration",
	"function",
	"assignment",
	"library",
	"input",
	"output",
	"length",
	"calldata",
	"interface",
	"global",
	"storage",
	"virtual",
	"override",
	"visibility",
	"mutability",
	"memory",
	"local",
	"mapping",
	"free",
	"array",
	"contract",
	"defaultLibrary",
	"block",
	"transaction",
	"struct",
	"payable",
	"external",
	"internal",
	"view",
	"pure",
]

const modifierNumbers = {
	0: 1,
	1: 2,
	2: 4,
	3: 8,
	4: 16,
	5: 32,
	6: 64,
	7: 128,
	8: 256,
	9: 512,
	10: 1024,
	11: 2048,
	12: 4096,
	13: 8192,
	14: 16384,
	15: 32768,
	16: 65536,
	17: 131072,
	18: 262144,
	19: 524288,
	20: 1048576,
	21: 2097152,
	22: 4194304,
	23: 8388608,
	24: 16777216,
	25: 33554432,
	26: 67108864,
	27: 134217728,
	28: 268435456,
	29: 536870912,
	30: 1073741824,
}

const tokenTypeMap = {
	"Free Function": "function.free",
	"free function": "function.free",
	"contract modifier": "modifier",
	"Modifier Argument": "modifier",
	"contract function": "function.contract",
	Constant: "constant",
	"Struct Property": "property.struct",
	"struct property": "property.struct",
	"library function": "function.library",
	"input param": "parameter.function.input",
	"output param": "parameter.function.output",
	"state variable": "variable.storage",
	"interface function": "function.interface",
	"Local Variable": "variable.local",
	"local variable": "variable.local",
	Struct: "struct",
}

export const computeSemanticTokens = (util: DocUtil) => {
	const semanticTokenBuilder = new vscode.SemanticTokensBuilder()
	const globals = globalNames()
	const [, doc] = util.getSelected()
	return new Promise<vscode.SemanticTokens | null>((resolve) => {
		try {
			const tokens = doc.getAllSemanticTokens()
			tokens.sort((a, b) => {
				const startA = a.location.range.start
				const startB = b.location.range.start
				if (startA.line !== startB.line) {
					return startA.line - startB.line
				}

				return startA.character - startB.character
			})
			tokens.forEach((t) => {
				const builtin = globals.find((g) => g.name === t.name)

				const type = t.info.type in tokenTypeMap ? tokenTypeMap[t.info.type] : t.info.type

				let returnType: string = type
				const modifiers: string[] = []
				if (type.indexOf(".") === -1) {
					returnType = builtin ? builtin.type : type
					if (builtin?.modifier) {
						modifiers.push("defaultLibrary")
						modifiers.push(...builtin.modifier.split("."))
					}
				} else {
					const [tokenType, ...mods] = type.split(".")
					if (mods) {
						modifiers.push(...mods)
					}
					returnType = tokenType
				}

				if (t.info.extra) {
					modifiers.push(...t.info.extra.split("."))
				}

				const { start, end } = util.wordRange(t.location.range.start)
				const expand = util.toText({ start, end: { line: start.line, character: end.character + 1 } })

				if (expand[expand.length - 1] === ":") {
					returnType = "property"
					modifiers.push("struct")
					modifiers.push("assignment")
				}

				const text = util.getWord(start)
				if (text.toLowerCase() === t.name.toLowerCase()) {
					let modid = 0
					for (const mod of modifiers) {
						modid = modid + modifierNumbers[tokenModifiers.indexOf(mod)]
					}
					semanticTokenBuilder.push(start.line, start.character, t.name.length, tokenTypes.indexOf(returnType), modid)
				}
			})

			resolve(semanticTokenBuilder.build())
		} catch (e) {
			console.debug("semantic", e)
			resolve(null)
		}
	})
}
