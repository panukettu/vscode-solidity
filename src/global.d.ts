declare module 'solc' {
	import type { SolcWrapper } from '@shared/compiler/solc-types';
	export const solc: SolcWrapper;
	export default solc;
}
