import { regex2, regexNamed, regexUnnamed } from "@shared/regexp"
import { CompletionItem, CompletionItemKind } from "vscode-languageserver"
import type { TypeReference } from "../search/TypeReference"
import type { ParsedCode } from "./ParsedCode"
import type { ParsedContract } from "./ParsedContract"
import { ParsedDeclarationType } from "./ParsedDeclarationType"
import type { ParsedDocument } from "./ParsedDocument"
import { ParsedFunction } from "./ParsedFunction"
import { ParsedVariable } from "./ParsedVariable"
import type { ElementParams } from "./types"
import { getTypeString } from "./utils/ParsedCodeTypeHelper"

const getNatspecPrefix = (text: string) => {
	const isVowel = text.match(/^[aeiou]/i)
	const article = isVowel ? "An" : "A"

	return `${article} ${text}`
}

function pluralize(word: string) {
	const wordLower = word.toLowerCase()
	if (/[^aeiou]y$/i.test(wordLower)) {
		return word.replace(/y$/i, "ies")
	}
	if (/[sxz]$/i.test(wordLower) || /[^aeioudgkprt]h$/i.test(wordLower)) {
		return `${word}es`
	}
	if (/[^aeiou]o$/i.test(wordLower)) {
		return `${word}es`
	}
	if (wordLower.toLowerCase() === "child") {
		return "children"
	}
	return `${word}s`
}
export class ParsedParameter extends ParsedVariable {
	public parent: ParsedCode
	private completionItem: CompletionItem = null
	public declare element: ElementParams

	public declare type: ParsedDeclarationType
	public isInput: boolean
	public isOutput: boolean

	public initialiseParameter(
		element: ElementParams,
		contract: ParsedContract,
		document: ParsedDocument,
		parent: ParsedCode,
	) {
		this.element = element
		this.name = element.name
		this.document = document
		this.contract = contract
		this.parent = parent

		const type = ParsedDeclarationType.create(element.literal, contract, document)
		this.element = element
		this.type = type
		if (element.id) {
			// no name on return parameters
			this.name = element.id
		}
	}

	public static extractParameters(
		params: ElementParams[],
		contract: ParsedContract,
		document: ParsedDocument,
		parent: ParsedCode,
		isInput: boolean,
		isOutput: boolean,
	): ParsedParameter[] {
		const parameters: ParsedParameter[] = []
		// @ts-expect-error
		if (!params.length && !params.params?.length) return parameters

		for (const parameterElement of params) {
			const parameter: ParsedParameter = new ParsedParameter()
			parameter.initialiseParameter(parameterElement, contract, document, parent)
			parameter.isInput = isInput
			parameter.isOutput = isOutput
			parameters.push(parameter)
		}

		return parameters
	}

	public static createParamsInfo(params: any): string {
		if (!params || !params.length) return ""
		let paramsInfo = params.hasOwnProperty("params") ? params.params : ""

		for (const parameterElement of params) {
			const currentParamInfo = ParsedParameter.getParamInfo(parameterElement)
			if (paramsInfo === "") {
				paramsInfo = currentParamInfo
			} else {
				paramsInfo = `${paramsInfo}, ${currentParamInfo}`
			}
		}

		return paramsInfo
	}

	public static createParamsInfoForSig(params: any): string {
		if (!params || !params.length) return ""
		let paramsInfo = params.hasOwnProperty("params") ? params.params : ""

		for (const parameterElement of params) {
			const currentParamInfo = ParsedParameter.getParamInfoSig(parameterElement)
			if (paramsInfo === "") {
				paramsInfo = currentParamInfo
			} else {
				paramsInfo = `${paramsInfo}, ${currentParamInfo}`
			}
		}
		return paramsInfo
	}

	public static getParamInfo(parameterElement: ElementParams) {
		const typeString = getTypeString(parameterElement.literal)

		let currentParamInfo = ""
		if (parameterElement.id) {
			// no name on return parameters
			currentParamInfo = typeString
		} else {
			currentParamInfo = typeString
		}
		return currentParamInfo
	}

	public static getParamInfoSig(parameterElement: any) {
		return getTypeString(parameterElement.literal)
	}

	public static createFunctionParamsSnippet(params: ElementParams[], skipFirst = false): string {
		if (!params || !params.length) return ""

		let paramsSnippet = ""
		let counter = 0

		for (const parameterElement of params) {
			if (skipFirst || parameterElement.id === "self" || parameterElement.id === "_self") {
				skipFirst = false
			} else {
				counter = counter + 1
				const currentParamSnippet = `\${${counter}:${getTypeString(parameterElement.literal)}}`
				if (paramsSnippet === "") {
					paramsSnippet = currentParamSnippet
				} else {
					paramsSnippet = `${paramsSnippet}, ${currentParamSnippet}`
				}
			}
		}

		return paramsSnippet
	}

	public override getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): TypeReference[] {
		if (this.isCurrentElementedSelected(offset)) {
			if (this.type.isCurrentElementedSelected(offset)) {
				return this.type.getAllReferencesToSelected(offset, documents)
			}
			return this.getAllReferencesToThis(documents)
		}
		return []
	}

	public override getAllReferencesToObject(parsedCode: ParsedCode): TypeReference[] {
		if (this.isTheSame(parsedCode)) {
			return [this.createFoundReferenceLocationResult()]
		}
		return this.type.getAllReferencesToObject(parsedCode)
	}

	public override getAllReferencesToThis(documents: ParsedDocument[]): TypeReference[] {
		const results: TypeReference[] = []
		results.push(this.createFoundReferenceLocationResult())
		return results.concat(this.parent.getAllReferencesToObject(this))
	}

	public createParamCompletionItem(type: string, contractName: string): CompletionItem {
		if (!this.completionItem) {
			let id = "[parameter name not set]"
			if (this.element.id != null) {
				id = this.element.id
			}
			const completionItem = CompletionItem.create(id)
			completionItem.kind = CompletionItemKind.Variable
			completionItem.documentation = this.getMarkupInfo()
			this.completionItem = completionItem
		}
		return this.completionItem
	}

	public createFieldCompletionItem(): CompletionItem {
		if (!this.completionItem) {
			let id = "[unnamed]"
			if (this.element.id != null) {
				id = this.element.id
			}
			const completionItem = CompletionItem.create(id)
			completionItem.kind = CompletionItemKind.Field
			completionItem.preselect = !!this.element.id
			completionItem.detail = `${this.getElementInfo()} (in ${this.parent.name})`
			completionItem.documentation = this.getShortInfo()
			this.completionItem = completionItem
		}
		return this.completionItem
	}

	public generateParamNatSpec(): string {
		const prefix = this.isInput ? "param" : "return"
		const typeInfo = this.getTypeInfo(true)

		const name = this.element.id ? this.element.id : this.type.name
		return ` * @${prefix} ${name} ${name !== typeInfo ? typeInfo : ""}`
	}

	public override getParsedObjectType(): string {
		if (this.isInput) {
			return "input param"
		}
		if (this.isOutput) {
			return "output param"
		}
		return "param"
	}

	public getComment(): string {
		let comment = ""
		comment = this.parent.getComment()
		if (!comment) {
			return ""
		}
		if (this.isInput) {
			const matches = regex2(this.name).exec(comment)
			if (matches?.length > 1) {
				return matches[1]
			}
		} else if (this.isOutput) {
			const matchesNamed = regexNamed(this.name).exec(comment)
			if (matchesNamed?.length > 1) {
				return matchesNamed[1]
			}
			const matches = regexUnnamed(this.name).exec(comment)
			if (matches?.length > 1) {
				return matches[1]
			}
		}
		return ""
	}

	public override getInfo(useActive?: boolean, isActive?: boolean, comments?: boolean): string {
		return this.createInfo(
			this.getRootName(),
			this.parent.name,
			this.getInfoText(useActive, isActive),
			this.getParsedObjectType(),
			true,
			true,
		)
	}

	public override getShortInfo(useActive?: boolean, isActive?: boolean): string {
		return this.createShortInfo(this.parent.name, this.getInfoText(useActive, isActive), true, true)
	}

	public getSignatureInfo(paramIndex?: number, skipSelf?: boolean): string {
		if (typeof paramIndex !== "undefined" && this.parent instanceof ParsedFunction) {
			const { paramsInfo, returnInfo } = this.parent.getParamsInfo(paramIndex, skipSelf)

			return `${this.parent.name}(${paramsInfo}): ${returnInfo}`
		}

		return ""
	}

	public getSignatureDoc(): string {
		const parentFunc = this.parent instanceof ParsedFunction ? this.parent : null
		let prefix = ""
		if (parentFunc) {
			const funcPrefix = parentFunc.getParsedParentType()
			prefix = ["Contract", "Interface"].includes(funcPrefix) ? "" : `${funcPrefix.toLowerCase()} function`
		} else {
		}
		const comment = this.getComment()
		const text = [
			comment ? comment.trim() : "",
			"\n--- \n",
			"```solidity",
			(prefix ? `${prefix} in ` : "function in ") + this.getRootName(),
			"```",
		].join("\n")
		return text
	}

	private getInfoText(useActive: boolean, isActive: boolean): string {
		let infoText = ""

		if (this.isInput) {
			const onlyParam = this.parent instanceof ParsedFunction && this.parent.input.length === 1
			const info = this.getElementInfo(useActive, isActive)
			infoText = onlyParam ? `(${info})` : `(...${info})`
		} else if (this.isOutput) {
			const hasInput = this.parent instanceof ParsedFunction && this.parent.input.length > 0
			infoText = `${hasInput ? "(...)" : "()"}: ${this.getElementInfo(useActive, isActive)}`
		} else {
			infoText = `: ${this.getElementInfo(useActive, isActive)}`
		}

		return infoText
	}

	public getTypeInfo(readable = false): string {
		const arraySig = this.type.getArraySignature()
		if (readable) {
			const prefix = getNatspecPrefix(this.type.name)
			let name = ""
			if (this.name) {
				const result = this.name.replace(/^_/, "").split(/(?=[A-Z])/)

				const letters = result
					.filter((x) => x.length === 1)
					.join("")
					.toUpperCase()
				name = result
					.filter((x) => x.length > 1)
					.map((x) => x.toLowerCase().trim())
					.concat(letters)
					.filter(Boolean)
					.join(" ")
			}

			const inputText =
				this.type.name !== "address"
					? `The ${name} (${this.type.name}).`
					: name.indexOf("address") !== -1
						? `The ${name}.`
						: `The ${name} address.`
			const arrayParts = this.type.getArrayParts()
			return arraySig
				? `List of ${arrayParts ? `${arrayParts} ` : ""}${pluralize(this.type.name)}.`
				: this.isInput
					? inputText
					: this.name
						? `${prefix} value.`
						: `Result of ${this.parent.name}.`
		}
		return this.type.name + arraySig
	}

	public getStorageType(space = true): string {
		let result = ""
		if (this.element.storage_location != null) {
			result = this.element.storage_location + (space ? " " : "")
		}
		return result
	}

	public getElementInfo(useActive = false, isActive = false): string {
		const id = this.element.id != null ? this.element.id : ""
		const storageType = this.getStorageType((!useActive && !isActive && !!id) || (useActive && isActive && !!id))
		// if (useActive && !isActive) {
		//   return this.getTypeInfo() + (storageType ? " " + storageType : "");
		// }
		return `${this.getTypeInfo()} ${storageType}${id}`
	}

	public getSignature(): string {
		return ParsedParameter.getParamInfo(this.element)
	}
}
