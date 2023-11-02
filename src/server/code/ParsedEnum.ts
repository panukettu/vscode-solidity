import { CompletionItem, CompletionItemKind } from "vscode-languageserver"
import { ParsedCode } from "./ParsedCode"
import { ParsedContract } from "./ParsedContract"
import { ParsedDocument } from "./ParsedDocument"

export class ParsedEnum extends ParsedCode {
	public items: string[] = []
	public id: any
	private completionItem: CompletionItem = null
	public override initialise(element: any, document: ParsedDocument, contract: ParsedContract, isGlobal: boolean) {
		super.initialise(element, document, contract, isGlobal)
		this.name = element.name
		this.id = element.id
		element.members.forEach((member) => {
			this.items.push(member)
		})
	}

	public override createCompletionItem(): CompletionItem {
		if (!this.completionItem) {
			const completionItem = CompletionItem.create(this.name)
			completionItem.kind = CompletionItemKind.Enum
			let contractName = ""
			if (!this.isGlobal) {
				contractName = this.contract.name
			} else {
				contractName = this.document.getGlobalPathInfo()
			}
			completionItem.insertText = this.name
			completionItem.documentation = this.getMarkupInfo()
			this.completionItem = completionItem
		}
		return this.completionItem
	}

	public override getInnerCompletionItems(): CompletionItem[] {
		const completionItems: CompletionItem[] = []
		this.items.forEach((property) => completionItems.push(CompletionItem.create(property)))
		return completionItems
	}

	public override getParsedObjectType(): string {
		return "Enum"
	}

	public override getInfo(): string {
		return (
			"### " +
			this.getParsedObjectType() +
			": " +
			this.name +
			"\n" +
			"#### " +
			this.getContractNameOrGlobal() +
			"\n" +
			this.getComment()
		)
	}
}
