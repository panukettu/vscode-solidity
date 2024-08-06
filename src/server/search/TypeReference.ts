import type * as vscode from "vscode-languageserver/node"
// import { ParsedContract } from "../code/ParsedContract";
import type { ParsedCode } from "../code/ParsedCode"

export class TypeReference {
	public isCurrentElementSelected: boolean
	public location: vscode.Location
	public reference: ParsedCode

	public static create(isSelected: boolean, location: vscode.Location = null, reference: ParsedCode = null) {
		const result = new TypeReference()
		result.location = location
		result.isCurrentElementSelected = isSelected
		result.reference = reference
		return result
	}

	public static filterFoundResults(results: TypeReference[]): TypeReference[] {
		const selecteds = results.filter((x) => x.isCurrentElementSelected)
		if (!selecteds.length) return []
		const locations = selecteds.filter((x) => x.location != null)
		if (!locations.length) return [TypeReference.create(true)]
		return locations
	}
}
