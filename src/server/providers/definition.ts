import { ParsedDocument } from '@server/code/ParsedDocument';
import { ParsedExpression } from '@server/code/ParsedExpression';
import * as vscode from 'vscode-languageserver/node';
import { ParsedCode } from '../code/ParsedCode';
import { CodeWalkerService } from '../code/walker/codeWalkerService';
import { clearCaches } from './utils/caches';

let currentOffset = 0;
let currentItem: ParsedCode | undefined;

export function defCtx() {
	return {
		currentOffset,
		currentItem,
	};
}
export const handleParsedExpression = (document: ParsedDocument, currentItem: ParsedExpression) => {
	const parent = currentItem.parent;
	if (!parent) return [];
	const parentContract = document.getAllContracts().find((c) => c.name === parent.name);
	if (!parentContract) return [];
	const foundMethods = parentContract.findMethodsInScope(currentItem.name);
	if (!foundMethods?.length) return [];
	return foundMethods.filter((f) => f?.getLocation);
};

export const getDefinition = (document: vscode.TextDocument, position: vscode.Position, walker: CodeWalkerService) => {
	try {
		currentOffset = document.offsetAt(position);
		const documentContractSelected = walker.getSelectedDocument(document, position);
		currentItem = documentContractSelected.getSelectedItem(currentOffset);
		if (!currentItem) return [];

		if (currentItem instanceof ParsedExpression) {
			const result = handleParsedExpression(documentContractSelected, currentItem);
			if (result?.length) return result.map((x) => x.getLocation());
		}

		const references = documentContractSelected.getSelectedTypeReferenceLocation(currentOffset);
		const refsWorkaround = currentItem.getSelectedTypeReferenceLocation(currentOffset);

		const foundLocations = references
			.concat(refsWorkaround)
			.filter((x) => x.location != null)
			.map((x) => x.location);

		if (!foundLocations?.length) {
			const item = documentContractSelected.findTypeInScope(currentItem.name);

			if (item?.getLocation) {
				foundLocations.push(item.getLocation());
			}
		}
		currentOffset = 0;
		currentItem = undefined;
		clearCaches();
		return foundLocations;
	} catch (e) {
		clearCaches();
		currentOffset = 0;
		currentItem = undefined;
		// console.debug('definition', e);
		return [];
	}
};
const removeDuplicates = (foundLocations: vscode.Location[]) => {
	return foundLocations.filter(
		(v, i, a) => a.findIndex((t) => t.uri === v.uri && t.range.start === v.range.start) === i
	);
};
