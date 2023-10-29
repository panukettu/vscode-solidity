import * as path from 'path';
import { isPathSubdirectory } from '../util';
import { Project } from './project';

export class Remapping {
	public context: string;
	public prefix: string;
	public target: string;
	public basePath: string;

	public isImportForThis(contractDependencyImport: string) {
		if (this.context != null) {
			return contractDependencyImport.startsWith(`${this.context}:${this.prefix}`);
		}
		return contractDependencyImport.startsWith(this.prefix);
	}

	public getLibraryPathIfRelative(projectPath: string) {
		if (!path.isAbsolute(this.target)) {
			const fullPath = path.join(this.basePath, this.target);
			if (isPathSubdirectory(projectPath, fullPath)) {
				return path.dirname(this.target).split(path.sep)[0];
			}
		}
		return null;
	}

	public createImportFromFile(filePath: string) {
		if (this.isFileForThis(filePath)) {
			if (path.isAbsolute(this.target)) {
				if (this.context == null) {
					return path.join(this.prefix, filePath.substring(this.target.length));
				}
				if (this.context != null) {
					return path.join(`${this.context}:${this.prefix}`, filePath.substring(this.target.length));
				}
			} else {
				if (this.context == null) {
					return path.join(this.prefix, filePath.substring(path.join(this.basePath, this.target).length));
				}
				if (this.context != null) {
					return path.join(
						`${this.context}:${this.prefix}`,
						filePath.substring(path.join(this.basePath, this.target).length)
					);
				}
			}
		}
	}

	public isFileForThis(filePath: string) {
		if (path.isAbsolute(this.target)) {
			return filePath.startsWith(this.target);
		} else {
			return filePath.startsWith(path.join(this.basePath, this.target));
		}
	}

	public resolveImport(contractDependencyImport: string) {
		if (contractDependencyImport == null) {
			return null;
		}
		const validImport = this.isImportForThis(contractDependencyImport);
		if (path.isAbsolute(this.target)) {
			if (validImport && this.context == null) {
				return path.join(this.target, contractDependencyImport.substring(this.prefix.length));
			}

			if (validImport && this.context != null) {
				return path.join(this.target, contractDependencyImport.substring(`${this.context}:${this.prefix}`.length));
			}
		} else {
			if (validImport && this.context == null) {
				return path.join(this.basePath, this.target, contractDependencyImport.substring(this.prefix.length));
			}

			if (validImport && this.context != null) {
				return path.join(
					this.basePath,
					this.target,
					contractDependencyImport.substring(`${this.context}:${this.prefix}`.length)
				);
			}
		}
		return null;
	}
}

export function importRemappings(remappings: string, project: Project): Array<Remapping> {
	const remappingArray = remappings.split(/\r\n|\r|\n/); // split lines
	return importRemappingArray(remappingArray, project);
}

export function importRemappingArray(remappings: string[], project: Project): Array<Remapping> {
	const remappingsList = new Array<Remapping>();
	if (remappings != null && remappings.length > 0) {
		// biome-ignore lint/complexity/noForEach: <explanation>
		remappings.forEach((remappingElement) => {
			const remapping = new Remapping();
			remapping.basePath = project.projectPackage.absoluletPath;
			const regex = /((?<context>[\S]+)\:)?(?<prefix>[\S]+)=(?<target>.+)/g;
			const match = regex.exec(remappingElement);
			if (match) {
				if (match.groups.context) {
					remapping.context = match.groups.context;
				}

				if (match.groups.prefix) {
					remapping.prefix = match.groups.prefix;
					remapping.target = match.groups.target;
					remappingsList.push(remapping);
				}
			}
		});
	}
	return remappingsList;
}
