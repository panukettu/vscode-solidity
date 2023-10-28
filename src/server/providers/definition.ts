import * as vscode from "vscode-languageserver/node";
import { ParsedCode } from "../code/ParsedCode";
import { CodeWalkerService } from "../code/walker/codeWalkerService";
import { selectedDocument } from "../utils";
import { clearCaches } from "./utils/caches";

export class SolidityDefinitionProvider {
	public static currentOffset: number = 0;
	public static currentItem: ParsedCode | null = null;

	public static provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		walker: CodeWalkerService,
	): vscode.Location | vscode.Location[] {
		try {
			this.currentOffset = document.offsetAt(position);
			const documentContractSelected = walker.getSelectedDocumentProfiler(
				document,
				position,
			);
			this.currentItem = documentContractSelected.getSelectedItem(
				this.currentOffset,
			);

			const references =
				documentContractSelected.getSelectedTypeReferenceLocation(
					this.currentOffset,
				);

			const foundLocations = references
				.filter((x) => x.location !== null)
				.map((x) => x.location);
			const result = this.removeDuplicates(foundLocations, ["range", "uri"]);

			if (!result.length) {
				const item = documentContractSelected.findTypeInScope(
					this.currentItem.name,
				);

				if (item?.getLocation) {
					const location = item.getLocation();
					result.push(location);
				}
			}
			this.currentOffset = 0;
			this.currentItem = null;
			clearCaches();
			return <vscode.Location[]>result;
		} catch (e) {
			clearCaches();
			this.currentOffset = 0;
			this.currentItem = null;
			// console.debug("definition", e);
			return null;
		}
	}
	// public static getDefinition(
	//   document: vscode.TextDocument,
	//   position: vscode.Position,
	//   walker: CodeWalkerService
	// ): ParsedCode[] {
	//   try {
	//     this.currentOffset = document.offsetAt(position);
	//     const documentContractSelected = walker.getSelectedDocument(
	//       document,
	//       position
	//     );
	//     this.currentItem = documentContractSelected.getSelectedItem(
	//       this.currentOffset
	//     );

	//     const references =
	//       documentContractSelected.getSelectedTypeReferenceLocation(
	//         this.currentOffset
	//       );

	//     console.debug(references);
	//     const foundLocations = references
	//       .filter((x) => x.location !== null)
	//       .map((x) => x.reference);

	//     if (foundLocations.length) {
	//       const item = documentContractSelected.findTypeInScope(
	//         this.currentItem.name
	//       );

	//       if (item) {
	//         foundLocations.push(item);
	//       }
	//     }
	//     this.currentOffset = 0;
	//     this.currentItem = null;
	//     clearCaches();
	//     return foundLocations;
	//   } catch (e) {
	//     clearCaches();
	//     this.currentOffset = 0;
	//     this.currentItem = null;
	//     // console.debug("Definition", e);
	//     return null;
	//   }
	// }

	public static removeDuplicates(foundLocations: any[], keys: string[]) {
		return Object.values(
			foundLocations.reduce((r, o: any) => {
				const key = keys.map((k) => o[k]).join("|");
				// tslint:disable-next-line:curly
				if (r[key]) r[key].condition = [].concat(r[key].condition, o.condition);
				// tslint:disable-next-line:curly
				else r[key] = { ...o };
				return r;
			}, {}),
		);
	}
}
