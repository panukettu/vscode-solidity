import * as fs from "fs"
import * as path from "path"
import axios from "axios"
import * as fse from "fs-extra"
import * as vscode from "vscode"
import { getCurrentProjectInWorkspaceRootFsPath } from "../../client/client-config"
import { SourceDocumentCollection } from "../project/sourceDocuments"

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class EtherscanDomainChainMapper {
	public static getMappings(): any {
		return {
			mainnet: "api.etherscan.io",
			arbitrum: "api.arbiscan.io",
			goerli: "api-goerli.etherscan.io",
			sepolia: "api-sepolia.etherscan.io",
			optimism: "api-optimistic.etherscan.io",
			optimismGoerli: "api-goerli-optimism.etherscan.io",
			arbitrumNova: "api-nova.arbiscan.io",
			arbitrumGoerli: "api-goerli.arbiscan.io",
			arbitrumSepolia: "api-sepolia.arbiscan.io",
			polygon: "api.polygonscan.com",
			polygonMumbai: "api-testnet.polygonscan.com",
			polygonZkevm: "api-zkevm.polygonscan.com",
			polygonZkevmTestnet: "api-testnet-zkevm.polygonscan.com",
			binance: "api.bscscan.com",
			moonbeam: "api-moonbeam.moonscan.io",
			moonriver: "api-moonriver.moonscan.io",
			gnosis: "api.gnosisscan.io",
			celo: "api.celoscan.io",
			avax: "api.snowtrace.io",
			fantom: "api.ftmscan.com",
		}
	}

	public static getDomain(chain: string) {
		return this.getMappings()[chain]
	}

	public static getChains(): string[] {
		return Object.keys(this.getMappings())
	}
}

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class EtherscanContractDownloader {
	public static isValiAddressMessage(
		address: string,
	): string | vscode.InputBoxValidationMessage | Thenable<string | vscode.InputBoxValidationMessage> {
		const invalidAddress = <vscode.InputBoxValidationMessage>{
			message: "Invalid address",
			severity: vscode.InputBoxValidationSeverity.Error,
		}
		if (!address) {
			return invalidAddress
		}
		address = address.toLowerCase()
		if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
			return invalidAddress
		} else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
			// If it's all small caps or all all caps, return true
			return null
		}
		return invalidAddress
	}

	public static hexLenth(hex: string): number {
		if (hex.startsWith("0x")) {
			return hex.length - 2
		}
		return hex.length
	}

	public static ensureHexPrefix(hex: string): string {
		if (hex.startsWith("0x")) {
			return hex
		}
		return hex
	}

	public static isValiAddress(address: string): boolean {
		if (!address) {
			return false
		}
		address = address.toLowerCase()
		if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
			return false
		} else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
			return true
		}
		return false
	}

	public static async downloadContractWithPrompts() {
		if (vscode.window.activeTextEditor) {
			try {
				const chains = EtherscanDomainChainMapper.getChains()
				const selectedChain: string = await vscode.window.showQuickPick(chains)
				const inputBox: vscode.InputBoxOptions = {}
				inputBox.title = "Please enter the contract address:"
				inputBox.prompt = "Please enter the contract address"
				inputBox.ignoreFocusOut = true
				inputBox.validateInput = this.isValiAddressMessage

				let selectedAddress: string = await vscode.window.showInputBox(inputBox)
				if (selectedAddress !== undefined) {
					// cancelled
					if (!this.isValiAddress(selectedAddress)) {
						throw "Invalid address"
					}
					selectedAddress = this.ensureHexPrefix(selectedAddress)
					const pathProject = getCurrentProjectInWorkspaceRootFsPath()
					const downloadedFiles = await EtherscanContractDownloader.downloadContract(
						selectedChain,
						selectedAddress,
						pathProject,
					)
					vscode.window.showInformationMessage(`Contract downloaded:${downloadedFiles[0]}`)
					const openPath = vscode.Uri.file(downloadedFiles[0])
					vscode.workspace.openTextDocument(openPath).then((doc) => {
						vscode.window.showTextDocument(doc)
					})
				}
			} catch (e) {
				vscode.window.showErrorMessage(`Error downloading contract: ${e}`)
			}
		} else {
			throw "Please open a file to identify the worspace"
		}
	}

	public static async downloadContract(
		chain: string,
		address: string,
		projectPath: string,
		subfolder = "chainContracts",
		apiKey = "YourApiKeyToken",
	): Promise<string[]> {
		const info = await EtherscanContractInfoService.getContractInfo(chain, address, apiKey)
		const downloadedFiles: string[] = []
		if (info.result.length > 0) {
			// one contract..
			const contractInfo = info.result[0]
			if (contractInfo.SourceCode === "") {
				throw "Contract has not been verified or found"
			}
			const subfolderFullPath = path.join(projectPath, contractInfo.ContractName)
			fse.ensureDirSync(subfolderFullPath)
			const abiFileName = `${contractInfo.ContractName}.abi`
			fs.writeFileSync(path.join(subfolderFullPath, abiFileName), contractInfo.ABI)
			const sourceCodeCollection: string[] = []
			if (contractInfo.SourceCode.startsWith("{")) {
				let sourceInfoString = contractInfo.SourceCode.trim()
				if (sourceInfoString.startsWith("{{")) {
					sourceInfoString = sourceInfoString.substring(1, sourceInfoString.length - 1)
				}
				const sourceInfo = JSON.parse(sourceInfoString)
				const fileNames = Object.keys(sourceInfo.sources)

				fileNames.forEach((fileName) => {
					const fullPathContractFile = path.join(subfolderFullPath, fileName)
					fse.ensureDirSync(path.dirname(fullPathContractFile))
					sourceCodeCollection.push(sourceInfo.sources[fileName].content)
					fs.writeFileSync(fullPathContractFile, sourceInfo.sources[fileName].content)
					downloadedFiles.push(fullPathContractFile)
				})
				const libraryImports = SourceDocumentCollection.getAllLibraryImports(sourceCodeCollection)
				const remappingContents = libraryImports.map((x) => `${x}=${x}`).join("\n")
				fs.writeFileSync(path.join(subfolderFullPath, "remappings.txt"), remappingContents)
			} else {
				const solidityFileName = `${contractInfo.ContractName}.sol`
				const fullPathContractFile = path.join(subfolderFullPath, solidityFileName)
				fs.writeFileSync(fullPathContractFile, contractInfo.SourceCode)
				downloadedFiles.push(fullPathContractFile)
			}
			return downloadedFiles
		}
	}
}

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class EtherscanContractInfoService {
	public static async getContractInfo(
		chain: string,
		address: string,
		apiKey = "YourApiKeyToken",
	): Promise<EtherscanContractInfoResponse> {
		const domain = EtherscanDomainChainMapper.getDomain(chain)
		const url = `https://${domain}/api?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`
		const response = await axios.get(url)
		return response.data as EtherscanContractInfoResponse
	}
}

export interface EtherscanContractInfoResponse {
	status: string
	message: string
	result: EtherscanContractInfo[]
}

export interface EtherscanContractInfo {
	SourceCode: string
	ABI: string
	ContractName: string
	CompilerVersion: string
	OptimizationUsed: string
	Runs: string
	ConstructorArguments: string
	EVMVersion: string
	Library: string
	LicenseType: string
	Proxy: string
	Implementation: string
	SwarmSource: string
}
