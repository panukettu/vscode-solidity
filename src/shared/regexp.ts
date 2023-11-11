// const backup1 = () => /Error \((\d+)\): (.+)\n.*?\S+.(.+):(\d+):(\d+)/gm;
// export const backup2 = () =>
// 	/(error|Error |Note|Warning)(?:.\s|\s?)(\((.*?)\))?:\s?(.*?)\n.*-->\W+(.*?):(\d+):(\d+):.*?\n.*?\n.*?\S+\s+(?=\w)(.*?(?=\W))\n/g;
// const functionRegexp = () => new RegExp(/(function.*?\()/g);

export const solcErrorRegexp = () => /Error.*?\((\d+)\).*?:.*?(.+)\n.*?\S+.(.+):(\d+):(\d+)/gm

export const solcOutputRegexp = () =>
	/(error|Error |Note|Warning)(?:.\s|\s?)(\((.*?)\))?:\s?(.*?)\n.*-->\W+(.*?):(\d+):(\d+):.*?\n.*?\n.*?\S+\s+(?=\w)(.*?(?=\W))\n|(Error) \((\d+)\): (.+)\n.*?\S+.(.+):(\d+):(\d+)/g

export const formatOutput = (stdout: string) =>
	stdout
		.replaceAll(/\[\d{0,2}m/g, "")
		// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
		.replaceAll(/(\x1B\d{0,2}?|\[\d;\d{2}\w)/g, "")
		// .replaceAll(/(\\x9B|\\x1B\[)[0-?]*[ -\/]*[@-~]/gm, '')
		.replaceAll(/(\r\n|\n|\r)/g, "\n")

// this does not work
const regexpToCaptureFunctionAndBodyWithinCurlyBRaces = () =>
	/function\s+(?<name>\w+)\s*\((?<args>.*?)\)\s*(?<modifiers>.*?)\s*\{(?<body>.*?)\}/gs
export const testFunctionRegexp = () => /function (test.*?)\(/g
export const errorRegexp = () => /error /g
export const functionDefRegexp = () => /function /g

export const functionRegexp = () =>
	new RegExp(/function\s+(?<name>\w+)\s*\((?<args>.*?)\)\s*(?<modifiers>.*?)(\;|\s*\{(?<body>.*?)\})/gs)
export const regex2 = (name: string) => new RegExp(`@param\\s${name}\\s(\.*\\w)`, "g")
export const regexNamed = (name: string) => new RegExp(`@return\\s${name}\\s(\.*\\w)`, "g")
export const regexUnnamed = (name: string) => new RegExp("@return\\s+(.+\\w)", "g")

export const existingFuncRegexp = new RegExp(/(.*?\(.*?\))/s)
export const innerImportRegexp = new RegExp(/(import\s\{)/s)
export const emitRegexp = new RegExp(/(emit\s)/s)
export const importRegexp = new RegExp(/(import\s)(?!\{)/s)
export const fromRegexp = new RegExp(/(import\s\{.*?\}\sfrom)/s)
export const importFullRegexp = new RegExp(/import\s*({(?<symbols>.*?)}\s*from\s*)?["'](?<from>.*?)["']/, "gm")
export const symbolIdRegexp = new RegExp(/import\s\{(.*?)\W/s)
// function\s+(?<name>\w+)\s*\((?<args>.*?)\)\s*(?<modifiers>.*?)\s*\{(?<body>.*?)\}

export const emitDotRegexp = /emit\s(\w+)\./g

export const mappingIdRegexp = /(\w+)(?=\[)/g
export const itemIdRegexp = /(\w+)(?=\()/g
export const isReplacingCallRegexp = new RegExp(/(.*?\(.*?\))/s)
export const mappingIdsRegexpOld = /([a-zA-Z0-9_()]+)\[([^\]]*)\](?:\[([^\]]*)\])*(?!\.)(?=\;?$)/s

export const dotStartWordsRegexp = /(\w+)(?=\()/g
export const mappingStartWordsREgexp = /(\w+)(?=\[)/g
export const mappingWordsRegexp = /([a-zA-Z0-9_()]+)\[([^\]]*)\](?:\[([^\]]*)\])*(?!\.)(?=\;?$)/s

export const keccak256Regexp = () => new RegExp(/(?<=keccak256\(")(.*?)(?="\))/g)

export const nameRegexp = new RegExp(/(?<=\W)(\w+)(?=\()/gs)

export const commentFormatRegexp = new RegExp(/\s(\w.+)/, "s")

export const lineMetadataRegexp = () =>
	new RegExp(/(?<type>\w+\s?\W+?)?(?<location>\w+)?\s(?<assignment>(?<variable>\w+)\s*=)/, "s")
export const funcDefMetadataRegexp = () =>
	new RegExp(/[\(](?<assignment>((?<type>.*?)(?<location>\s\w+)?)\s(?<variable>\w+))\s*[,|\)|{]/, "g")

// Example funcs:

/**
 * 
 *   
 * 
function ensureMinDebtValue(Asset storage _asset, address _krAsset, uint256 _debtAmount) internal view {
	uint256 positionValue = _asset.krAssetUSD(_debtAmount);
	uint256 minDebtValue = cs().minDebtValue;
	if (positionValue < minDebtValue)
			revert Errors.MINT_VALUE_LESS_THAN_MIN_DEBT_VALUE(Errors.id(_krAsset), positionValue, minDebtValue);
}
function debtValueToAmount(Asset storage self, uint256 _value, bool _ignoreKFactor) internal view returns (uint256 amount) {
	if (_value == 0) return 0;

	uint256 assetPrice = self.price();
	if (!_ignoreKFactor) {
			assetPrice = assetPrice.percentMul(self.kFactor);
	}

	return _value.wadDiv(assetPrice);
}

function checkDust(Asset storage _asset, uint256 _burnAmount, uint256 _debtAmount) internal view returns (uint256 amount) {
	if (_burnAmount == _debtAmount) return _burnAmount;
	// If the requested burn would put the user's debt position below the minimum
	// debt value, close up to the minimum debt value instead.
	uint256 krAssetValue = _asset.debtAmountToValue(_debtAmount - _burnAmount, true);
	uint256 minDebtValue = cs().minDebtValue;
	if (krAssetValue > 0 && krAssetValue < minDebtValue) {
			uint256 minDebtAmount = minDebtValue.wadDiv(_asset.price());
			amount = _debtAmount - minDebtAmount;
	} else {
			amount = _burnAmount;
	}
}


function minCollateralValueAtRatio(
	Asset storage _krAsset,
	uint256 _amount,
	uint32 _ratio
) internal view returns (uint256 minCollateralValue) {
	if (_amount == 0) return 0;
	// Calculate the collateral value required to back this Kresko asset amount at the given ratio
	return _krAsset.debtAmountToValue(_amount, false).percentMul(_ratio);
}
 */
