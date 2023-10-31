import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	CompletionItem,
	Hover,
	Location,
	MarkupContent,
	MarkupKind,
	Position,
	Range,
} from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { ParsedContract } from './ParsedContract';
import { ParsedDocument } from './ParsedDocument';
import { ParsedFunction } from './ParsedFunction';

import { commentFormatRegexp } from '../providers/utils/matchers';
import { TypeReference } from '../search/TypeReference';
import { BodyElement, Element, ElementParams, InnerElement } from './types';

export class ParsedCode {
	public element: Element | InnerElement | BodyElement | ElementParams;
	public name = '';
	public document: ParsedDocument;
	public contract: ParsedContract;
	public isGlobal: boolean;
	public supportsNatSpec = true;
	public comment: string;

	public initialise(
		element: Element | BodyElement | InnerElement | ElementParams,
		document: ParsedDocument,
		contract: ParsedContract = null,
		isGlobal = false
	) {
		this.contract = contract;
		this.element = element;
		this.name = element.name;
		this.document = document;
		this.isGlobal = isGlobal; // need to remove is global
		if (contract != null && isGlobal === false) {
			this.isGlobal = true;
		}
	}

	public getHover(): Hover {
		const doc: MarkupContent = this.getMarkupInfo(false);
		return {
			contents: doc,
		};
	}

	public getMarkupInfo(short = true): MarkupContent {
		return {
			kind: MarkupKind.Markdown,
			value: short ? this.getShortInfo() : this.getInfo(),
		};
	}

	public getInfo(): string {
		return `### ${this.name}\n${this.getComment()}`;
	}
	public getShortInfo(): string {
		return `#### ${this.name}\n${this.getComment()}`;
	}

	public getSelectedItem(offset: number): ParsedCode {
		if (this.isCurrentElementedSelected(offset)) {
			return this;
		}
		return null;
	}

	public generateNatSpec(): string {
		return null;
	}

	public isCommentLine(document: TextDocument, line: number): boolean {
		if (line === 0) {
			return false;
		}
		const txt: string = document.getText(this.getLineRange(line)).trimStart();
		if (
			!txt.startsWith('///') &&
			!txt.startsWith('*') &&
			!txt.startsWith('/**') &&
			!txt.startsWith('/*!') &&
			!txt.startsWith('*/')
		) {
			return false;
		} else {
			return true;
		}
	}

	public getLineRange(lineNumber: number) {
		return Range.create(Position.create(lineNumber, 0), Position.create(lineNumber + 1, 0));
	}
	public getRootName(incldueTypeName = false): string {
		if (this.contract != null) {
			const prefix = incldueTypeName ? `${this.contract.name}.` : '';
			return prefix + this.contract.name;
		} else {
			const source = this.document.sourceDocument.absolutePath.split('/');
			return source[source.length - 1];
		}
	}
	public getContractNameOrGlobal(): string {
		if (this.contract != null) {
			return `${this.contract.getContractTypeName(this.contract.contractType).toLowerCase()}: ${this.contract.name}`;
		} else {
			const item = this.document.findItem(this.name);
			if (item) {
				return `(global) ${item.element.type}`;
			} else {
				const item = this.document.findType(this.name);
				if (item) {
					return item.element.type;
				} else {
					return '';
				}
			}
		}
	}

	public createShortInfo(
		parent: string,
		itemInfo: string,
		withComment?: boolean,
		formatComment?: boolean,
		objectTypeOverride?: string
	) {
		const objectTypeString =
			objectTypeOverride != null ? objectTypeOverride : `(${this.getParsedObjectType().toLowerCase()})`;
		let comment = '';
		if (withComment) {
			comment = this.getComment(formatComment);
		}
		const text = [
			'```solidity',
			`${objectTypeString ? `${objectTypeString} ` : ''}${parent}${itemInfo}`,
			'```',
			comment?.length > 0 ? `--- \n \n${comment || ''}` : '',
		].join('\n');

		return text;
	}
	public createInfo(
		grandparent: string,
		parent: string,
		itemInfo: string,
		objectType?: string,
		withComment?: boolean,
		formatComment?: boolean
	) {
		if (grandparent === 'Global') {
			grandparent = grandparent.toLowerCase();
		}
		const objectTypeString = objectType ? objectType : this.getParsedObjectType().toLowerCase();

		const grandParentString = grandparent ? `${grandparent}.` : '';

		let comment = '';
		if (withComment) {
			comment = this.getComment(formatComment);
		}
		const text = [
			'```solidity',
			`(${objectTypeString}) ${grandParentString}${parent}${itemInfo}`,
			'```',
			comment?.length > 0 ? `--- \n \n${comment || ''}` : '',
		].join('\n');

		return text;
	}

	public getComment(format = false): string {
		if (!this.comment && this.supportsNatSpec && this.element) {
			try {
				const uri = URI.file(this.document.sourceDocument.absolutePath).toString();
				const document = TextDocument.create(uri, null, null, this.document.sourceDocument.unformattedCode);
				const position = document.positionAt(this.element.start);
				let comment = '';
				let currentLine = position.line - 1;
				while (this.isCommentLine(document, currentLine)) {
					let content = document.getText(this.getLineRange(currentLine)).trimStart();
					const inherits = content.match(/(?<=@inheritdoc\s)(\w+)/g);
					if (inherits?.length > 0) {
						const inheritFrom = inherits[0];
						const inheritDoc = this.document.getAllContracts().find((d) => d.name === inheritFrom);
						if (inheritDoc) {
							const item = this.document.getSelectedItem(this.element.start);
							const itemInherit = inheritDoc.findMethodsInScope(item.name);
							if (itemInherit?.length > 0) {
								content = itemInherit[0].getComment().trimStart();
							}
						}
					}
					if (format) {
						const matches = commentFormatRegexp.exec(content);
						content = matches?.length > 1 ? matches[1] || '' : '';
						comment = content + comment;
					} else {
						comment = `\t${content}${comment}`;
					}

					currentLine = currentLine - 1;
				}
				this.comment = comment;
			} catch (e) {
				return this.comment == null ? '' : this.comment;
			}
		}
		return this.comment == null ? '' : this.comment;
	}

	public createFoundReferenceLocationResult(): TypeReference {
		return TypeReference.create(true, this.getLocation(), this);
	}

	public createNotFoundReferenceLocationResult(): TypeReference {
		return TypeReference.create(false);
	}

	public createFoundReferenceLocationResultNoLocation(): TypeReference {
		return TypeReference.create(true, null, this);
	}

	public isTheSame(parsedCode: ParsedCode): boolean {
		try {
			const sameObject = parsedCode === this;
			const sameDocReference =
				this.document.sourceDocument.absolutePath === parsedCode.document.sourceDocument.absolutePath &&
				this.name === parsedCode.name &&
				this.element.start === parsedCode.element.start &&
				this.element.end === parsedCode.element.end;
			return sameObject || sameDocReference;
		} catch (error) {
			// console.log(error);
		}
	}

	public getAllReferencesToObject(parsedCode: ParsedCode): TypeReference[] {
		if (this.isTheSame(parsedCode)) {
			return [this.createFoundReferenceLocationResult()];
		}
		return [];
	}

	public findElementByOffset(elements: Array<any>, offset: number): any {
		return elements.find((element) => element.start <= offset && offset <= element.end);
	}

	public isElementedSelected(element: any, offset: number): boolean {
		if (!element) return false;

		if (element.start <= offset && offset <= element.end) {
			return true;
		}
	}
	public createCompletionItem(): CompletionItem {
		return null;
	}
	public initCompletionItem(): CompletionItem {
		const completionItem = CompletionItem.create(this.name);
		const remapping = this.document.sourceDocument.project.findRemappingForFile(
			this.document.sourceDocument.absolutePath
		);

		if (remapping) {
			completionItem.data = {
				absolutePath: this.document.sourceDocument.absolutePath,
				remappedPath: remapping.createImportFromFile(this.document.sourceDocument.absolutePath),
			};
		} else {
			completionItem.data = {
				absolutePath: this.document.sourceDocument.absolutePath,
				remappedPath: this.document.sourceDocument.absolutePath,
			};
		}
		return completionItem;
	}

	public isCurrentElementedSelected(offset: number): boolean {
		return this.isElementedSelected(this.element, offset);
	}

	public getLocation(): Location {
		const uri = URI.file(this.document.sourceDocument.absolutePath).toString();
		const document = TextDocument.create(uri, null, null, this.document.sourceDocument.unformattedCode);
		return Location.create(
			document.uri,
			Range.create(document.positionAt(this.element.start), document.positionAt(this.element.end))
		);
	}

	public getSelectedTypeReferenceLocation(offset: number): TypeReference[] {
		if (this.isCurrentElementedSelected(offset)) {
			return [TypeReference.create(true)];
		}
		return [TypeReference.create(false)];
	}

	public getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): TypeReference[] {
		if (this.isCurrentElementedSelected(offset)) {
			return this.getAllReferencesToThis(documents);
		}
		return [];
	}

	public getAllReferencesToThis(documents: ParsedDocument[]): TypeReference[] {
		let results: TypeReference[] = [];
		results.push(this.createFoundReferenceLocationResult());
		let documentsToSearch: ParsedDocument[] = [];
		for (const document of documents) {
			documentsToSearch = documentsToSearch.concat(document.getDocumentsThatReference(this.document));
		}
		documentsToSearch = [...new Set(documentsToSearch)];

		for (const document of documentsToSearch) {
			results = results.concat(document.getAllReferencesToObject(this));
		}
		return results;
	}

	public findTypeInScope(name: string): ParsedCode {
		if (!this.contract) {
			return this.document.findType(name);
		} else {
			return this.contract.findType(name);
		}
	}

	public findMethodsInScope(name: string, includeExtendedMethods = false): ParsedCode[] {
		let result: ParsedCode[] = [];
		if (!this.contract) {
			result = result.concat(this.document.findMethodCalls(name, includeExtendedMethods));
		} else {
			result = result.concat(this.contract.findMethodCalls(name, includeExtendedMethods));
		}

		return result;
	}

	public getSelectedFunction(offset: number, includeExtendedMethods = false): ParsedFunction {
		if (!this.contract) {
			const inner = this.document.innerContracts
				.flatMap((x) => x.getAllFunctions(true, includeExtendedMethods))
				.find((i) => i.isCurrentElementedSelected(offset));
			if (inner) return inner;

			const allFuncs = this.document.getAllGlobalFunctions(includeExtendedMethods);
			return allFuncs.find((f) => f.isCurrentElementedSelected(offset));
		} else {
			return this.contract.getSelectedFunction(offset, includeExtendedMethods);
		}
	}

	public findMembersInScope(name: string): ParsedCode[] {
		if (!this.contract) {
			return this.document.findMembersInScope(name);
		} else {
			return this.contract.findMembersInScope(name);
		}
	}

	public getInnerCompletionItems(): CompletionItem[] {
		return [];
	}

	public getInnerMembers(): ParsedCode[] {
		return [];
	}

	public getInnerMethodCalls(): ParsedCode[] {
		return [];
	}

	public getParsedObjectType(): string {
		return '';
	}

	protected mergeArrays<Type>(first: Type[], second: Type[]): Type[] {
		for (let i = 0; i < second.length; i++) {
			if (first.indexOf(second[i]) === -1) {
				first.push(second[i]);
			}
		}
		return first;
	}
}
