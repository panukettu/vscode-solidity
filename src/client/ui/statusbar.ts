import * as vscode from "vscode"

const statusBars: vscode.StatusBarItem[] = []

export const clearAllStatusBars = () => {
	statusBars.forEach((statusBar) => statusBar.dispose())
}

export const createStatusBarTest = (id: string, text: string) => {
	const statusBar = vscode.window.createStatusBarItem(id, vscode.StatusBarAlignment.Left, -1)
	statusBar.name = "vsc-solidity-test"
	statusBar.text = text
	statusBar.show()
	statusBars.push(statusBar)
	return statusBar
}
export const createStatusBar = (id: string, text: string) => {
	const statusBar = vscode.window.createStatusBarItem(id, vscode.StatusBarAlignment.Left, -1)
	statusBar.name = "vsc-solidity"
	statusBar.text = text
	statusBar.show()
	statusBars.push(statusBar)
	return statusBar
}
