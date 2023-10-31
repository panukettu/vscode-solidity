import * as path from 'path';
import { glob } from 'glob';
import { Package } from './package';
import { Remapping, importRemappingArray } from './remapping';

export class Project {
	public projectPackage: Package;
	public dependencies: Array<Package>;
	public libs: string[];
	public remappings: Remapping[];
	public rootPath: string;

	constructor(
		projectPackage: Package,
		dependencies: Array<Package>,
		libs: string[],
		remappings: string[],
		rootPath: string
	) {
		this.projectPackage = projectPackage;
		this.dependencies = dependencies;
		this.libs = libs;
		this.remappings = importRemappingArray(remappings, this);
		this.rootPath = rootPath;
	}
	// This will need to add the current package as a parameter to resolve version dependencies
	public findDependencyPackage(contractDependencyImport: string) {
		return this.dependencies.find((depPack: Package) => depPack.isImportForThis(contractDependencyImport));
	}
	public getLibSourceFiles() {
		return Array.from(
			new Set(
				this.dependencies.flatMap((d) => {
					const lib = d.getSolSourcesAbsolutePath();
					return d.sol_sources_alternative_directories.flatMap((dir) => glob.sync(path.join(lib, dir, '/**/*.sol')));
				})
			)
		);
	}
	public getProjectSolFiles(extraExcludes?: string[]) {
		const sourcesPath = this.projectPackage.getSolSourcesAbsolutePath();

		const exclusions: string[] =
			extraExcludes?.length > 0 ? extraExcludes.map((item) => path.join(sourcesPath, '**', item, '/**/*.sol')) : [];

		const projectFiles = `${sourcesPath}/**/*.sol`;
		if (this.rootPath !== sourcesPath) {
			return glob.sync(projectFiles, { ignore: exclusions });
		}
		for (const libFolder of this.libs) {
			exclusions.push(path.join(sourcesPath, libFolder, '**'));
		}

		exclusions.push(path.join(sourcesPath, this.projectPackage.build_dir, '**'));

		for (const x of this.getAllRelativeLibrariesAsExclusionsFromRemappings()) {
			exclusions.push(x);
		}

		return glob.sync(projectFiles, { ignore: exclusions });
	}

	public getAllRelativeLibrariesAsExclusionsFromRemappings(): string[] {
		return this.getAllRelativeLibrariesRootDirsFromRemappingsAbsolutePaths().map((x) => path.join(x, '**'));
	}

	public getAllRelativeLibrariesRootDirsFromRemappings(): string[] {
		const results: string[] = [];

		// biome-ignore lint/complexity/noForEach: <explanation>
		this.remappings.forEach((mapping) => {
			const dirLib = mapping.getLibraryPathIfRelative(this.projectPackage.getSolSourcesAbsolutePath());
			if (dirLib != null && results.find((x) => x === dirLib) == null) {
				results.push(dirLib);
			}
		});
		return results;
	}

	public getAllRelativeLibrariesRootDirsFromRemappingsAbsolutePaths() {
		return this.getAllRelativeLibrariesRootDirsFromRemappings().map((x) =>
			path.resolve(this.projectPackage.getSolSourcesAbsolutePath(), x)
		);
	}

	public findImportRemapping(contractDependencyImport: string): Remapping {
		// const remappings = importRemappings("@openzeppelin/=lib/openzeppelin-contracts//\r\nds-test/=lib/ds-test/src/", this);
		const foundRemappings = [];
		// biome-ignore lint/complexity/noForEach: <explanation>
		this.remappings.forEach((mapping) => {
			if (mapping.isImportForThis(contractDependencyImport)) {
				foundRemappings.push(mapping);
			}
		});

		if (foundRemappings.length > 0) {
			return this.sortByLength(foundRemappings)[foundRemappings.length - 1];
		}
		return null;
	}

	public findRemappingForFile(filePath: string): Remapping {
		const foundRemappings = [];
		// biome-ignore lint/complexity/noForEach: <explanation>
		this.remappings.forEach((remapping) => {
			if (remapping.isFileForThis(filePath)) {
				foundRemappings.push(remapping);
			}
		});

		if (foundRemappings.length > 0) {
			return this.sortByLength(foundRemappings)[foundRemappings.length - 1];
		}
		return null;
	}

	private sortByLength(array: any[]) {
		return array.sort(function (a, b) {
			return a.length - b.length;
		});
	}
}
