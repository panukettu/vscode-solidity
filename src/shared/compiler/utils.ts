import * as fs from "fs"
import * as https from "https"
export function peekSolcReleases(): Promise<object> {
	const url = "https://binaries.soliditylang.org/bin/list.json"
	return new Promise((resolve, reject) => {
		https
			.get(url, (res) => {
				let body = ""
				res.on("data", (chunk) => {
					body += chunk
				})
				res.on("end", () => {
					try {
						const binList = JSON.parse(body)
						resolve(binList.releases)
					} catch (error) {
						reject(error.message)
					}
				})
			})
			.on("error", (error) => {
				reject(error.message)
			})
	})
}
export function getRemoteSolc(version: string, savePath: string): Promise<void> {
	const file = fs.createWriteStream(savePath)
	return new Promise((resolve, reject) => {
		const request = https
			.get(`https://binaries.soliditylang.org/bin/soljson-${version}.js`, function (response) {
				if (response.statusCode !== 200) {
					reject(`Error retrieving solr: ${response.statusMessage}`)
				} else {
					response.pipe(file)
					file.on("finish", function () {
						file.close()
						resolve()
					})
				}
			})
			.on("error", function (error) {
				reject(error)
			})
		request.end()
	})
}
export function getVersionFromFilename(fileName: string): string {
	let version = ""
	const value: string = fileName
	if (value !== "undefined") {
		version = value.replace("soljson-", "")
		version = version.replace(".js", "")
	} else {
		throw "Remote version: Invalid file name"
	}
	return version
}

export function parseReleaseVersion(version: string): Promise<string> {
	// biome-ignore lint/suspicious/noAsyncPromiseExecutor: <explanation>
	return new Promise(async (resolve, reject) => {
		if (version === "latest") {
			resolve(version)
		}
		try {
			const releases = await peekSolcReleases()
			// tslint:disable-next-line:forin
			for (const release in releases) {
				const fullVersion = getVersionFromFilename(releases[release])
				if (version === fullVersion) {
					resolve(fullVersion)
				}
				if (version === release) {
					resolve(fullVersion)
				}
				if (version === releases[release]) {
					resolve(fullVersion)
				}
				if (`v${release}` === version) {
					resolve(fullVersion)
				}
				if (version.startsWith(`v${release}+commit`)) {
					resolve(fullVersion)
				}
			}
			reject("Remote solc: invalid version")
		} catch (error) {
			reject(error)
		}
	})
}
