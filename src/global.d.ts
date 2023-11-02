declare module "solc" {
	import type { SolcWrapper } from "@shared/compiler/types-solc"
	export const solc: SolcWrapper
	export default solc
}
