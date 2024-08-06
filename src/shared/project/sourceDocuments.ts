import * as fs from "node:fs"
import type { SolcInput } from "@shared/compiler/types-solc"
import type { Project } from "./project"
import type { Remapping } from "./remapping"
import { SourceDocument } from "./sourceDocument"

const mockContent = (content: string) => `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n${content}`
export const mockConsoleSol =
	"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\nlibrary safeconsole { function log(string memory s) internal pure { } }\nlibrary console2 { function log(string memory) internal pure { } }\nlibrary console { function log(string memory) internal pure { } }"

export class SourceDocumentCollection {
	public documents: Map<string, SourceDocument> = new Map()

	private project: Project

	constructor(project: Project) {
		this.project = project
	}

	public static getAllLibraryImports(codeFiles: string[]): string[] {
		let imports: string[] = []
		codeFiles.forEach((x) => {
			imports = imports.concat(SourceDocument.getAllLibraryImports(x))
		})
		return [...new Set(imports)]
	}

	public containsSourceDocument(contractPath: string) {
		return this.documents.has(contractPath)
	}

	public getSolcInputSource() {
		return this.getSourceCodes(true, 300000)
	}

	public getSourceCodes(skipConsoleSols = false, sizeLimit = 0): SolcInput["sources"] {
		const contractsForCompilation = {}
		for (const contract of this.documents.values()) {
			if (
				skipConsoleSols &&
				(contract.absolutePath.includes("safeconsole.sol") ||
					contract.absolutePath.includes("onsole.sol") ||
					contract.absolutePath.includes("onsole2.sol"))
			) {
				contractsForCompilation[contract.absolutePath] = {
					content: mockConsoleSol,
				}
				continue
			}

			if (sizeLimit && contract.code.length > sizeLimit) {
				const identifier = contract.unformattedCode.match(/(contract|library|interface)\s(.*?)\s{/g)
				console.debug("Skipped contract", contract.absolutePath, "due to size limit")
				if (identifier.length) {
					contractsForCompilation[contract.absolutePath] = {
						content: mockContent(identifier.map((id) => `${id} }`).join("\n")),
					}
				}
				continue
			}

			contractsForCompilation[contract.absolutePath] = {
				content: contract.code,
			}
		}

		return contractsForCompilation
	}

	public addSourceDocumentAndResolveImports(contractPath: string, code: string | null) {
		const contract = this.addSourceDocument(contractPath, code)
		if (!contract) return this.documents.get(contractPath)

		contract.resolveImports()

		for (const imported of contract.imports) {
			if (!this.containsSourceDocument(imported.importPath)) {
				const code = this.readContractCode(imported.importPath)
				if (code) this.addSourceDocumentAndResolveImports(imported.importPath, code)
			} else this.addSourceDocumentAndResolveDependencyImport(imported.importPath, contract)
		}

		return contract
	}

	private addSourceDocument(contractPath: string, code: string | null) {
		if (this.documents.has(contractPath)) return

		const contract = new SourceDocument(this.project, contractPath, code || this.readContractCode(contractPath))
		this.documents.set(contractPath, contract)
		return contract
	}

	private readContractCode(contractPath: string) {
		if (!fs.existsSync(contractPath)) return null
		return fs.readFileSync(contractPath, "utf8")
	}

	private addSourceDocumentAndResolveDependencyImport(importPath: string, contract: SourceDocument) {
		this.addSourceDocumentAndResolveDependencyImportFromContractFullPath(
			this.project.resolveImport(importPath, contract),
			contract,
			importPath,
		)
	}

	private addSourceDocumentAndResolveDependencyImportFromContractFullPath(
		resolvedPath: string,
		contract: SourceDocument,
		parentPath: string,
	) {
		if (!resolvedPath) return
		if (!this.containsSourceDocument(resolvedPath)) {
			const importContractCode = this.readContractCode(resolvedPath)
			if (importContractCode != null) {
				this.addSourceDocumentAndResolveImports(resolvedPath, importContractCode)
				contract.replaceDependencyPath(parentPath, resolvedPath)
			}
		} else {
			contract.replaceDependencyPath(parentPath, resolvedPath)
		}
	}
}
