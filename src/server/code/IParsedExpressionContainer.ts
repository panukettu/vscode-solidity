import type { ParsedCode } from "./ParsedCode"
import type { ParsedExpression } from "./ParsedExpression"

export interface IParsedExpressionContainer extends ParsedCode {
	expressions: ParsedExpression[]
	initialiseVariablesMembersEtc(statement: any, parentStatement: any, child: ParsedExpression): void
}
