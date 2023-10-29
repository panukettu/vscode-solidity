import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedContract } from './ParsedContract';
import { ParsedDeclarationType } from './ParsedDeclarationType';
import { ParsedDocument } from './ParsedDocument';
import { ParsedVariable } from './ParsedVariable';

export class ParsedStateVariable extends ParsedVariable {
	private completionItem: CompletionItem = null;

	public element: any;

	public initialise(element: any, document: ParsedDocument, contract: ParsedContract) {
		super.initialise(element, document, contract);
		this.name = element.name;
		this.type = ParsedDeclarationType.create(element.literal, contract, document);
	}

	public createCompletionItem(select?: boolean): CompletionItem {
		if (!this.completionItem) {
			const item = CompletionItem.create(this.name);
			item.kind = CompletionItemKind.Field;
			if (this.type.isMapping) {
				item.insertText = this.name + this.type.createMappingSnippet() + ';';
				item.insertTextFormat = 2;
			}
			item.detail = `${this.getRootName()}.${this.name}`;
			item.preselect = select;
			item.documentation = {
				kind: 'markdown',
				value: this.getShortInfo(true),
			};
			this.completionItem = item;
		}
		return this.completionItem;
	}

	public override getParsedObjectType(): string {
		return 'State Variable';
	}

	public override getInfo(): string {
		return this.createInfo(this.getRootName(), '', `${this.getElementInfo()}`, undefined, true, true);
	}

	public override getShortInfo(comments?: boolean): string {
		const elemInfo = this.getElementInfo();
		return this.createShortInfo('', elemInfo, comments, comments, '(state)');
	}

	public getElementInfo(): string {
		const storageType = this.getStorageType();

		return this.name + ': ' + this.type.getTypeSignature() + ' ' + (storageType || '');
	}
	public getStorageType(space = true): string {
		let result = '';
		if (!!this.element?.storage_location) {
			result = this.element?.storage_location + (space ? ' ' : '');
		}
		return result;
	}
}
