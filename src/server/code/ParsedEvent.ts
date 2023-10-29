import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { TypeReference } from '../search/TypeReference';
import { ParsedCode } from './ParsedCode';
import { ParsedContract } from './ParsedContract';
import { ParsedDocument } from './ParsedDocument';
import { ParsedParameter } from './ParsedParameter';
import { Element } from './types';

export class ParsedEvent extends ParsedCode {
	public input: ParsedParameter[] = [];
	public contract: ParsedContract;
	public isGlobal: boolean;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	public id: any;
	private completionItem: CompletionItem = null;
	public element: Element;

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	public override initialise(element: any, document: ParsedDocument, contract: ParsedContract, isGlobal = false) {
		super.initialise(element, document, contract, isGlobal);
		this.name = element.name;
		this.id = element.id;
		this.initialiseParamters();
	}

	public initialiseParamters() {
		this.input = ParsedParameter.extractParameters(
			this.element?.params ?? [],
			this.contract,
			this.document,
			this,
			true,
			false
		);
	}

	public override createCompletionItem(skipFirstParamSnipppet = false): CompletionItem {
		if (!this.completionItem) {
			const completionItem = CompletionItem.create(this.name);
			completionItem.kind = CompletionItemKind.Event;
			const paramsSnippet = ParsedParameter.createFunctionParamsSnippet(this.element.params, skipFirstParamSnipppet);
			completionItem.insertTextFormat = 2;
			completionItem.insertText = `${this.name}(${paramsSnippet});`;
			completionItem.documentation = this.getMarkupInfo();
			this.completionItem = completionItem;
		}
		return this.completionItem;
	}

	public override getSelectedTypeReferenceLocation(offset: number): TypeReference[] {
		if (this.isCurrentElementedSelected(offset)) {
			const foundResult = TypeReference.filterFoundResults(
				this.input.flatMap((x) => x.getSelectedTypeReferenceLocation(offset))
			);
			if (foundResult.length > 0) {
				return foundResult;
			} else {
				return [TypeReference.create(true)];
			}
		}
		return [TypeReference.create(false)];
	}

	public override getSelectedItem(offset: number): ParsedCode {
		let selectedItem: ParsedCode = null;
		if (this.isCurrentElementedSelected(offset)) {
			let allItems: ParsedCode[] = [];
			allItems = allItems.concat(this.input);
			selectedItem = allItems.find((x) => x.getSelectedItem(offset));
			if (selectedItem) {
				return selectedItem;
			}
			return this;
		}
		return selectedItem;
	}

	public override getParsedObjectType(): string {
		return 'Event';
	}

	public getElementInfo(): string {
		const paramsInfo = ParsedParameter.createParamsInfo(this.element.params);
		return `${this.name}(${paramsInfo})`;
	}
	public override getInfo(): string {
		return this.createInfo(this.getRootName(), '', `${this.getElementInfo()}`, undefined, true, false);
		// return (
		//   "### " +
		//   elementType +
		//   ": " +
		//   this.name +
		//   "\n" +
		//   "#### " +
		//   this.getContractNameOrGlobal() +
		//   "\n" +
		//   "\t" +
		//   this.getSignature() +
		//   " \n\n" +
		//   this.getComment()
		// );
	}

	public getDeclaration(): string {
		return 'event';
	}
	public getSignature(): string {
		const paramsInfo = ParsedParameter.createParamsInfo(this.element.params);
		return `${this.getDeclaration()} ${this.name}(${paramsInfo}) \n\t\t`;
	}
}
