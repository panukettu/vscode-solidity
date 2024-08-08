import axios from "axios"

export type ContractResponse = {
	status: string
	message: string
	result: EtherscanContractInfo[]
}

export type EtherscanContractInfo = {
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

export const EtherscanAPI = {
	apis: {
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
	},
	async sources(chain: string, address: string, apiKey = "YourApiKeyToken") {
		return (
			await axios.get<ContractResponse>(
				`https://${this.apis[chain]}/api?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`,
			)
		).data
	},
	get chains() {
		return Object.keys(this.apis)
	},
}
