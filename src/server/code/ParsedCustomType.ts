import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedCode } from './ParsedCode';
import { ParsedContract } from './ParsedContract';
import { ParsedDocument } from './ParsedDocument';

export class ParsedCustomType extends ParsedCode {
	public isType: string;
	private completionItem: CompletionItem = null;

	public override initialise(element: any, document: ParsedDocument, contract: ParsedContract, isGlobal: boolean) {
		super.initialise(element, document, contract, isGlobal);
		this.element = element;
		this.isType = element.isType;
	}

	public override createCompletionItem(): CompletionItem {
		if (!this.completionItem) {
			const completionItem = CompletionItem.create(this.name);
			completionItem.kind = CompletionItemKind.Field;
			let contractName = '';
			if (!this.isGlobal) {
				contractName = this.contract.name;
			} else {
				contractName = this.document.getGlobalPathInfo();
			}
			// const typeString = this.isType;
			completionItem.insertText = this.name;
			completionItem.documentation = this.getMarkupInfo();
			this.completionItem = completionItem;
		}
		return this.completionItem;
	}

	public override getParsedObjectType(): string {
		return 'Custom Type';
	}

	public override getInfo(): string {
		return `${this.getParsedObjectType()}: ${this.name}\n${this.getContractNameOrGlobal()}\n${this.isType}\n`;
	}
}
