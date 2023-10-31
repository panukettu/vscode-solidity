import * as path from 'path';
import { formatPath } from '../util';
import { Project } from './project';

type Import = {
	importPath: string;
	symbols?: string[];
};

export class SourceDocument {
	public code: string;
	public unformattedCode: string;
	// TODO: Import needs to be a class including if is local, absolutePath, module etc
	public imports: Array<Import>;
	public absolutePath: string;
	public packagePath: string;
	public abi: string;
	public project: Project;

	public static getAllLibraryImports(code: string): string[] {
		const importRegEx = /^\s?import\s+[^'"]*['"](.*)['"]\s*/gm;
		const imports: string[] = [];
		let foundImport = importRegEx.exec(code);
		while (foundImport != null) {
			const importPath = foundImport[1];

			if (importPath[0] !== '.') {
				imports.push(importPath);
			}

			foundImport = importRegEx.exec(code);
		}
		return imports;
	}

	public static isImportLocal(importPath: string) {
		return importPath.startsWith('.');
	}

	constructor(absoulePath: string, code: string, project: Project) {
		this.absolutePath = this.formatDocumentPath(absoulePath);
		this.code = code;
		this.unformattedCode = code;
		this.project = project;
		this.imports = new Array<Import>();
	}

	/**
	 * Resolve import statement to absolute file path
	 *
	 * @param {string} importPath import statement in *.sol contract
	 * @param {SourceDocument} contract the contract where the import statement belongs
	 * @returns {string} the absolute path of the imported file
	 */
	public resolveImportPath(importPath: string): string {
		if (importPath[0] === '.') {
			return this.formatDocumentPath(path.resolve(path.dirname(this.absolutePath), importPath));
		} else if (this.project) {
			const remapping = this.project.findImportRemapping(importPath);
			if (remapping != null) {
				return this.formatDocumentPath(remapping.resolveImport(importPath));
			} else {
				const depPack = this.project.findDependencyPackage(importPath);
				if (depPack != null) {
					return this.formatDocumentPath(depPack.resolveImport(importPath));
				}
			}
		}
		return importPath;
	}

	public getAllImportFromPackages() {
		const importsFromPackages = new Array<string>();

		for (const immported of this.imports) {
			if (!this.isImportLocal(immported.importPath)) {
				importsFromPackages.push(immported.importPath);
			}
		}
		return importsFromPackages;
	}

	public isImportLocal(importPath: string) {
		return SourceDocument.isImportLocal(importPath);
	}

	public formatDocumentPath(contractPath: string) {
		return formatPath(contractPath);
	}

	public replaceDependencyPath(importPath: string, depImportAbsolutePath: string) {
		const importRegEx = /(^\s?import\s+[^'"]*['"])(.*)(['"]\s*)/gm;
		this.code = this.code.replace(importRegEx, (match, p1, p2, p3) => {
			if (p2 === importPath) {
				return p1 + depImportAbsolutePath + p3;
			} else {
				return match;
			}
		});
	}

	public resolveImports() {
		// const importRegEx = /^\s?import\s+[^'"]*['"](.*)['"]\s*/gm;
		const importRegEx = /import\s\{?(.*?(?=\}))?([^'"]*['"](.*)['"])\s*/gm;
		let foundImport = importRegEx.exec(this.code);
		while (foundImport != null) {
			const symbols = foundImport[1] ? foundImport[1].split(',').map((s) => s.trim()) : undefined;
			const importPath = foundImport[3];

			if (this.isImportLocal(importPath)) {
				const importFullPath = this.formatDocumentPath(path.resolve(path.dirname(this.absolutePath), importPath));
				this.imports.push({
					importPath: importFullPath,
					symbols: symbols,
				});
			} else {
				this.imports.push({
					importPath: importPath,
					symbols: symbols,
				});
			}

			foundImport = importRegEx.exec(this.code);
		}
	}
}
