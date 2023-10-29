import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as toml from '@iarna/toml';
import * as yaml from 'yaml-js';
import { SolidityConfig } from '../server/types';
import { Package } from './model/package';
import { Project } from './model/project';
import * as util from './util';

const packageConfigFileName = 'dappFile';
const remappingConfigFileName = 'remappings.txt';
const brownieConfigFileName = 'brownie-config.yaml';
const hardhatConfigFileName = 'hardhat.config.js';
const truffleConfigFileName = 'truffle-config.js';
const foundryConfigFileName = 'foundry.toml';

const projectFilesAtRoot = [
	remappingConfigFileName,
	brownieConfigFileName,
	foundryConfigFileName,
	hardhatConfigFileName,
	truffleConfigFileName,
	packageConfigFileName,
];

// These are set using user configuration settings
// const libLocations = 'lib';
// const defaultSourceLocation = 'src';
// const sourceLocationsLibs = ['', 'src', 'contracts'];

export function findFirstRootProjectFile(rootPath: string, currentDocument: string) {
	return util.findDirUpwardsToCurrentDocumentThatContainsAtLeastFileNameSync(
		projectFilesAtRoot,
		currentDocument,
		rootPath
	);
}

function readYamlSync(filePath: string) {
	const fileContent = fs.readFileSync(filePath);
	return yaml.load(fileContent);
}

export function initialiseProject(
	rootPath: string,
	config: SolidityConfig
): {
	project: Project;
	sources: string;
	remappings: string[];
} {
	// adding defaults to packages

	let sources = config.sources;
	const foundrySources = getSourcesLocationFromFoundryConfig(rootPath);
	const hardhatSource = getSourcesLocationFromHardhatConfig(rootPath);
	if (!sources) {
		sources = foundrySources.src;
	}
	if (!sources) {
		sources = hardhatSource;
	}

	const projectPackage = createDefaultPackage(rootPath, sources, config.outDir);

	const dependencies: Package[] = loadAllPackageDependencies(config.libs, rootPath, projectPackage, config.libSources);
	const remappings = loadRemappings(rootPath, config.remappings);
	return {
		project: new Project(projectPackage, dependencies, config.libs, remappings, rootPath),
		sources: sources,
		remappings: remappings,
	};
}

function loadAllPackageDependencies(libs: string[], rootPath: string, projectPackage: Package, sources: string[]) {
	let dependencies: Package[] = [];
	// biome-ignore lint/complexity/noForEach: <explanation>
	libs.forEach((libDirectory) => {
		dependencies = dependencies.concat(loadDependencies(rootPath, projectPackage, libDirectory, sources));
	});
	return dependencies;
}

function getSourcesLocationFromHardhatConfig(rootPath: string): string | null {
	try {
		const hardhatConfigFile = path.join(rootPath, hardhatConfigFileName);
		if (fs.existsSync(hardhatConfigFile)) {
			const config = require(hardhatConfigFile);
			// biome-ignore lint/complexity/useLiteralKeys: <explanation>
			const sourceLocation: string = config['paths']['sources'];
			if (sourceLocation) {
				return sourceLocation;
			}
		}
		return null;
	} catch (e) {
		// console.debug("sol.hardhat.sources", e.message);
		return null;
	}
}
function getSourcesLocationFromFoundryConfig(rootPath: string): { src: string; test: string; script: string } | null {
	const foundryConfigFile = path.join(rootPath, foundryConfigFileName);
	if (fs.existsSync(foundryConfigFile)) {
		try {
			const fileContent = fs.readFileSync(foundryConfigFile, 'utf8');
			const configOutput = toml.parse(fileContent);
			// biome-ignore lint/complexity/useLiteralKeys: <explanation>
			const sourceLocation: string = configOutput['profile']['default']['src'];
			// biome-ignore lint/complexity/useLiteralKeys: <explanation>
			const scriptLocation: string = configOutput['profile']['default']['script'];
			// biome-ignore lint/complexity/useLiteralKeys: <explanation>
			const testLocation: string = configOutput['profile']['default']['test'];
			if (!sourceLocation && !scriptLocation && !testLocation) {
				return null;
			}
			return {
				src: sourceLocation,
				script: scriptLocation,
				test: testLocation,
			};
		} catch (error) {
			// console.debug("sol.foundry.sources", error.message);
		}
		return null;
	}
	return null;
}

// function getSourcesLocationFromFoundryConfig(rootPath: string): string | null {
//   const foundryConfigFile = path.join(rootPath, foundryConfigFileName);
//   if (fs.existsSync(foundryConfigFile)) {
//     try {
//       const fileContent = fs.readFileSync(foundryConfigFile, "utf8");
//       const configOutput = toml.parse(fileContent);
//       const sourceLocation: string = configOutput["profile"]["default"]["src"];
//       if (!sourceLocation) {
//         return null;
//       }
//       return sourceLocation;
//     } catch (error) {
//       console.log("sol.foundry.sources", error.message);
//     }
//     return null;
//   }
//   return null;
// }
function getRemappingsFromFoundryConfig(rootPath: string): string[] {
	const foundryConfigFile = path.join(rootPath, foundryConfigFileName);
	if (fs.existsSync(foundryConfigFile)) {
		try {
			const fileContent = fs.readFileSync(foundryConfigFile, 'utf8');
			const configOutput = toml.parse(fileContent);
			// biome-ignore lint/style/useConst: <explanation>
			let remappingsLoaded: string[];
			// biome-ignore lint/complexity/useLiteralKeys: <explanation>
			remappingsLoaded = configOutput['profile']['default']['remappings'];
			if (!remappingsLoaded || remappingsLoaded.length === 0) {
				return null;
			}
			return remappingsLoaded;
		} catch (error) {
			console.log('remappings', error.message);
		}
		return;
	}
	return null;
}

function getRemappingsFromBrownieConfig(rootPath: string): string[] {
	const brownieConfigFile = path.join(rootPath, brownieConfigFileName);
	if (fs.existsSync(brownieConfigFile)) {
		const config = readYamlSync(brownieConfigFile);
		let remappingsLoaded: string[];
		try {
			remappingsLoaded = config.compiler.solc.remappings;
			if (!remappingsLoaded) {
				return;
			}
			// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
		} catch (TypeError) {
			return;
		}
		const remappings = remappingsLoaded.map((i) => {
			const [alias, packageID] = i.split('=');
			if (packageID.startsWith('/')) {
				// correct processing for imports defined with global path
				return `${alias}=${packageID}`;
			} else {
				return `${alias}=${path.join(os.homedir(), '.brownie', 'packages', packageID)}`;
			}
		});
		return remappings;
	}
	return null;
}

function getRemappingsFromRemappingsFile(rootPath: string) {
	const remappingsFile = path.join(rootPath, remappingConfigFileName);
	if (fs.existsSync(remappingsFile)) {
		const remappings = [];
		const fileContent = fs.readFileSync(remappingsFile, 'utf8');
		const remappingsLoaded = fileContent.split(/\r\n|\r|\n/); // split lines
		if (remappingsLoaded) {
			// biome-ignore lint/complexity/noForEach: <explanation>
			remappingsLoaded.forEach((element) => {
				remappings.push(element);
			});
		}
		return remappings;
	}
	return null;
}

export function loadRemappings(rootPath: string, remappings: string[]): string[] {
	if (!remappings) {
		remappings = [];
	}

	// Brownie prioritezes brownie-config.yml over remappings.txt
	// but changing to remappings over foundry
	remappings =
		getRemappingsFromBrownieConfig(rootPath) ??
		getRemappingsFromFoundryConfig(rootPath) ??
		getRemappingsFromRemappingsFile(rootPath) ??
		remappings;

	return remappings;
}

function loadDependencies(
	rootPath: string,
	projectPackage: Package,
	libLocation: string,
	libSourcesLocations: string[],
	libPackages: Array<Package> = new Array<Package>()
) {
	const libPath = path.join(projectPackage.absoluletPath, libLocation);
	if (!fs.existsSync(libPath)) return libPackages;

	// biome-ignore lint/complexity/noForEach: <explanation>
	getDirectories(libPath).forEach((directory) => {
		const depPackage = createDefaultPackage(path.join(libPath, directory), undefined, projectPackage.build_dir);
		depPackage.sol_sources_alternative_directories = libSourcesLocations;
		if (!libPackages.some((existingDepPack: Package) => existingDepPack.name === depPackage.name)) {
			libPackages.push(depPackage);

			loadDependencies(rootPath, depPackage, libLocation, libSourcesLocations, libPackages);
		}
	});

	return libPackages;
}

function getDirectories(dirPath: string): string[] {
	return fs.readdirSync(dirPath).filter(function (file) {
		const subdirPath = path.join(dirPath, file);
		return fs.statSync(subdirPath).isDirectory();
	});
}

function createDefaultPackage(packagePath: string, sources = '', outDir = 'bin'): Package {
	const defaultPackage = new Package(sources, outDir);
	defaultPackage.absoluletPath = packagePath;
	defaultPackage.name = path.basename(packagePath);
	return defaultPackage;
}
