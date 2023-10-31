import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedDeclarationType } from './ParsedDeclarationType';
import { ParsedDocument } from './ParsedDocument';
import { ParsedParameter } from './ParsedParameter';
import { ParsedVariable } from './ParsedVariable';
import { BodyElement } from './types';

export class ParsedConstant extends ParsedVariable {
	public from: string;
	private completionItem: CompletionItem = null;
	public declare element: BodyElement;
	public override initialise(element: BodyElement, document: ParsedDocument) {
		super.initialise(element, document);
		this.name = element.name;
		this.type = ParsedDeclarationType.create(element.literal, null, document);
	}

	public override createCompletionItem(preselect?: boolean): CompletionItem {
		if (!this.completionItem) {
			const completionItem = CompletionItem.create(this.name);
			completionItem.kind = CompletionItemKind.Field;
			completionItem.insertText = this.name;
			completionItem.detail = this.getElementInfo();
			completionItem.documentation = {
				kind: 'markdown',
				value: this.getInfo(true),
			};
			completionItem.preselect = preselect;
			this.completionItem = completionItem;
		}
		return this.completionItem;
	}

	public override getParsedObjectType(): string {
		return 'Constant';
	}

	public override getInfo(comment?: boolean): string {
		const elemInfo = this.getElementInfo();
		return this.createInfo(this.getRootName(), this.name, `: ${elemInfo}`, undefined, comment, comment);
	}

	public override getShortInfo(comment?: boolean): string {
		return this.createShortInfo(
			this.name,
			this.getElementInfo(),
			comment,
			comment,
			`${this.getRootName()} ${this.getParsedObjectType()}`.toLowerCase()
		);
	}
	public getElementInfo(): string {
		return `${this.type.getTypeSignature()} ${this.name}`;
	}

	public getSignature(): string {
		return ParsedParameter.getParamInfo(this.element as any);
	}
}
