import * as fs from "node:fs"
import * as path from "node:path"
import { EtherscanAPI } from "@shared/etherscan"
import axios from "axios"
import * as fse from "fs-extra"
import * as vscode from "vscode"
import { SourceDocumentCollection } from "../../shared/project/sourceDocuments"
import { Config, getCurrentProjectInWorkspaceRootFsPath } from "../client-config"

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class Etherscan {
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
		}
		if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
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

	public static isValidAddress(address: string): boolean {
		if (!address) {
			return false
		}
		address = address.toLowerCase()
		if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
			return false
		}
		if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
			return true
		}
		return false
	}

	public static async downloadContractWithPrompts() {
		if (vscode.window.activeTextEditor) {
			try {
				const chains = EtherscanAPI.chains
				const selectedChain: string = await vscode.window.showQuickPick(chains)
				const inputBox: vscode.InputBoxOptions = {}
				inputBox.title = "Please enter the contract address:"
				inputBox.prompt = "Please enter the contract address"
				inputBox.ignoreFocusOut = true
				inputBox.validateInput = Etherscan.isValiAddressMessage

				let selectedAddress: string = await vscode.window.showInputBox(inputBox)
				if (selectedAddress !== undefined) {
					// cancelled
					if (!Etherscan.isValidAddress(selectedAddress)) throw "Invalid address"

					selectedAddress = Etherscan.ensureHexPrefix(selectedAddress)

					const files = await Etherscan.downloadContract(selectedChain, selectedAddress)
					vscode.window.showInformationMessage(`Contract downloaded:${files[0]}`)
					const openPath = vscode.Uri.file(files[0])
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

	public static async downloadContract(chain: string, address: string, apiKey = "YourApiKeyToken"): Promise<string[]> {
		const info = await EtherscanAPI.sources(chain, address, apiKey)
		const downloaded: string[] = []
		if (!info.result?.length) throw "Contract not found"

		// one contract..
		const data = info.result[0]
		if (data.SourceCode === "") throw "Contract has not been verified or found"

		const savePath = path.join(
			getCurrentProjectInWorkspaceRootFsPath(),
			Config.getDownloadsDir(),
			chain,
			data.ContractName,
		)
		fse.ensureDirSync(savePath)

		fs.writeFileSync(path.join(savePath, `${data.ContractName}.abi.json`), data.ABI)
		fs.writeFileSync(
			path.join(savePath, `${data.ContractName}.abi.ts`),
			`export const ${data.ContractName}Config = { address: "${address}", abi: ${data.ABI} } as const`,
		)

		const sourceCodes: string[] = []
		if (data.SourceCode.startsWith("{")) {
			let sourceCode = data.SourceCode.trim()
			if (sourceCode.startsWith("{{")) {
				sourceCode = sourceCode.substring(1, sourceCode.length - 1)
			}
			const sourceInfo = JSON.parse(sourceCode)

			Object.keys(sourceInfo.sources).forEach((fileName) => {
				sourceCodes.push(sourceInfo.sources[fileName].content)
				const filePath = path.join(savePath, fileName)
				fse.ensureDirSync(path.dirname(filePath))

				fs.writeFileSync(filePath, sourceInfo.sources[fileName].content)

				downloaded.push(filePath)
			})
			const libraryImports = SourceDocumentCollection.getAllLibraryImports(sourceCodes)
			const remappingContents = libraryImports.map((x) => `${x}=${x}`).join("\n")
			fs.writeFileSync(path.join(savePath, "remappings.txt"), remappingContents)
		} else {
			const resultPath = path.join(savePath, `${data.ContractName}.sol`)
			fs.writeFileSync(resultPath, data.SourceCode)
			downloaded.push(resultPath)
		}
		return downloaded
	}
}
