import { CompletionItem, CompletionItemKind } from "vscode-languageserver"
import { TypeReference } from "../search/TypeReference"
import { ParsedCode } from "./ParsedCode"
import { ParsedContract } from "./ParsedContract"
import { ParsedDocument } from "./ParsedDocument"
import { ParsedParameter } from "./ParsedParameter"
import { Element } from "./types"

export class ParsedError extends ParsedCode {
	public input: ParsedParameter[] = []

	public id: any
	private completionItem: CompletionItem = null
	public declare element: Element

	public override initialise(element: any, document: ParsedDocument, contract: ParsedContract, isGlobal: boolean) {
		super.initialise(element, document, contract, isGlobal)
		this.name = element.name
		this.initialiseParamters()
		this.id = element.id
	}

	public initialiseParamters() {
		this.input = ParsedParameter.extractParameters(
			this.element?.params ?? [],
			this.contract,
			this.document,
			this,
			true,
			false,
		)
	}

	public override createCompletionItem(): CompletionItem {
		if (!this.completionItem) {
			const completionItem = CompletionItem.create(this.name)
			completionItem.kind = CompletionItemKind.Function

			const paramsSnippet = ParsedParameter.createFunctionParamsSnippet(this.element.params, false)
			completionItem.insertTextFormat = 2
			completionItem.insertText = `${this.name}(${paramsSnippet});`

			completionItem.documentation = this.getMarkupInfo()

			this.completionItem = completionItem
		}
		return this.completionItem
	}

	public override getSelectedTypeReferenceLocation(offset: number): TypeReference[] {
		if (this.isCurrentElementedSelected(offset)) {
			let results: TypeReference[] = []

			for (const x of this.input) {
				results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset))
			}

			const foundResult = TypeReference.filterFoundResults(results)
			if (foundResult.length > 0) {
				return foundResult
			} else {
				return [TypeReference.create(true)]
			}
		}
		return [TypeReference.create(false)]
	}

	public override getSelectedItem(offset: number): ParsedCode {
		let selectedItem: ParsedCode = null
		if (this.isCurrentElementedSelected(offset)) {
			let allItems: ParsedCode[] = []
			allItems = allItems.concat(this.input)
			selectedItem = allItems.find((x) => x.getSelectedItem(offset))
			if (selectedItem) {
				return selectedItem
			}
			return this
		}
		return selectedItem
	}

	public override getParsedObjectType(): string {
		return "Error"
	}

	public override getInfo(): string {
		const elementType = this.getParsedObjectType()
		return `### ${elementType}: ${
			this.name
		}\n#### ${this.getContractNameOrGlobal()}\n\t${this.getSignature()} \n\n${this.getComment()}`
	}

	public getDeclaration(): string {
		return "error"
	}
	public getSignature(): string {
		const paramsInfo = ParsedParameter.createParamsInfo(this.element.params)
		return `${this.getDeclaration()} ${this.name}(${paramsInfo}) \n\t\t`
	}
}
