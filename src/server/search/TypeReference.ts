// import { ParsedContract } from "../code/ParsedContract";
import { ParsedCode } from "../code/ParsedCode"

import * as vscode from "vscode-languageserver/node"
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
		const foundResult = results.filter((x) => x.isCurrentElementSelected === true)
		if (foundResult.length > 0) {
			const foundLocations = foundResult.filter((x) => x.location != null)
			if (foundLocations.length > 0) {
				return foundLocations
			} else {
				return [TypeReference.create(true)]
			}
		} else {
			return []
		}
	}
}
