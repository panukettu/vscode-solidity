import * as fs from "fs"
import { SolcInput } from "@shared/compiler/types-solc"
import { MultisolcSettings } from "@shared/types"
import { formatPath } from "../util"
import { Project } from "./project"
import { SourceDocument } from "./sourceDocument"

export class SourceDocumentCollection {
	public documents: Array<SourceDocument>

	public static getAllLibraryImports(codeFiles: string[]): string[] {
		let imports: string[] = []
		codeFiles.forEach((x) => {
			imports = imports.concat(SourceDocument.getAllLibraryImports(x))
		})
		return [...new Set(imports)]
	}

	constructor() {
		this.documents = new Array<SourceDocument>()
	}

	public isDocumentPathTheSame(contract: SourceDocument, contractPath: string) {
		return contract.absolutePath === contractPath
	}

	public containsSourceDocument(contractPath: string) {
		return (
			this.documents.findIndex((contract: SourceDocument) => {
				return contract.absolutePath === contractPath
			}) > -1
		)
	}

	public getMinimalSolcInput(maxContracts?: number): SolcInput {
		return {
			language: "Solidity",
			settings: {
				viaIR: false,
				optimizer: {
					enabled: false,
					runs: 0,
				},
				outputSelection: {
					"*": {
						"": [],
						"*": [],
					},
				},
			},
			sources: this.getSourceCodes(true),
		}
	}

	public getSolcInput(args: MultisolcSettings) {
		return {
			...args.compilerConfig,
			sources: this.getSourceCodes(),
		}
	}

	public getSourceCodes(skipConsoleSols = false): SolcInput["sources"] {
		const contractsForCompilation = {}

		for (const contract of this.documents) {
			if (skipConsoleSols && contract.absolutePath.includes("/safeconsole.sol")) {
				contractsForCompilation[contract.absolutePath] = {
					content: "pragma solidity ^0.8.0; library safeconsole { function log(string memory s) internal pure { } }",
				}
				continue
			}
			if (skipConsoleSols && contract.absolutePath.includes("/console.sol")) {
				contractsForCompilation[contract.absolutePath] = {
					content: "pragma solidity ^0.8.0; library console { function log(string memory s) internal pure { } }",
				}
				continue
			}

			contractsForCompilation[contract.absolutePath] = {
				content: contract.code,
			}
		}

		return contractsForCompilation
	}

	public addSourceDocumentAndResolveImports(contractPath: string, code: string, project: Project) {
		const contract = this.addSourceDocument(contractPath, code, project)
		if (contract) {
			contract.resolveImports()

			for (const imported of contract.imports) {
				if (fs.existsSync(imported.importPath)) {
					if (!this.containsSourceDocument(imported.importPath)) {
						const importContractCode = this.readContractCode(imported.importPath)
						if (importContractCode) {
							this.addSourceDocumentAndResolveImports(imported.importPath, importContractCode, project)
						}
					}
				} else {
					this.addSourceDocumentAndResolveDependencyImport(imported.importPath, contract, project)
				}
			}
		}
		return contract
	}

	private addSourceDocument(contractPath: string, code: string, project: Project) {
		if (!this.containsSourceDocument(contractPath)) {
			const contract = new SourceDocument(contractPath, code, project)
			this.documents.push(contract)
			return contract
		}
		return null
	}

	private formatContractPath(contractPath: string) {
		return formatPath(contractPath)
	}

	private getAllImportFromPackages() {
		const importsFromPackages = new Array<string>()

		for (const contract of this.documents) {
			const contractImports = contract.getAllImportFromPackages()
			for (const contractImport of contractImports) {
				if (importsFromPackages.indexOf(contractImport) < 0) {
					importsFromPackages.push(contractImport)
				}
			}
		}

		return importsFromPackages
	}

	private readContractCode(contractPath: string) {
		if (fs.existsSync(contractPath)) {
			return fs.readFileSync(contractPath, "utf8")
		}
		return null
	}

	private addSourceDocumentAndResolveDependencyImport(
		dependencyImport: string,
		contract: SourceDocument,
		project: Project,
	) {
		// find re-mapping
		const remapping = project.findImportRemapping(dependencyImport)
		if (remapping != null) {
			const importPath = this.formatContractPath(remapping.resolveImport(dependencyImport))
			this.addSourceDocumentAndResolveDependencyImportFromContractFullPath(
				importPath,
				project,
				contract,
				dependencyImport,
			)
		} else {
			const depPack = project.findDependencyPackage(dependencyImport)
			if (depPack != null) {
				const depImportPath = this.formatContractPath(depPack.resolveImport(dependencyImport))
				this.addSourceDocumentAndResolveDependencyImportFromContractFullPath(
					depImportPath,
					project,
					contract,
					dependencyImport,
				)
			}
		}
	}

	private addSourceDocumentAndResolveDependencyImportFromContractFullPath(
		importPath: string,
		project: Project,
		contract: SourceDocument,
		dependencyImport: string,
	) {
		if (!this.containsSourceDocument(importPath)) {
			const importContractCode = this.readContractCode(importPath)
			if (importContractCode != null) {
				this.addSourceDocumentAndResolveImports(importPath, importContractCode, project)
				contract.replaceDependencyPath(dependencyImport, importPath)
			}
		} else {
			contract.replaceDependencyPath(dependencyImport, importPath)
		}
	}
}
