export type Literal = {
	type: string
	literal: string
	members: any[]
	array_parts: any[]
	start: number
	end: number
}

export type LiteralMapping = {
	type: "MappingExpression"
	literal: BodyLiteral
	members: any[]
	array_parts: any[]
	from?: any
	to?: any
	start: number
	end: number
}

export type ReturnParams = {
	type: "ReturnParams"
	params: ElementParams[]
	start: 2878
	end: 2895
}

export type BodyLiteral = {
	type: string
	literal: Literal | LiteralMapping
	members: any[]
	array_parts: any[]
	start: number
	end: number
}

export type ElementParams = {
	type: string
	name?: string
	literal: Literal
	id: string
	is_indexed: boolean
	is_constant: boolean
	params?: ElementParams[]
	returnParams: ReturnParams
	storage_location: any | null
	start: number
	end: number
}
export type ImportElement = {
	type: "ImportStatement"
	from: string
	symbols: { type: "Symbol"; name: string; alias: string; start: number; end: number }[]
	start: number
	end: number
}
export type BodyElement = {
	type: string
	name?: string
	from?: string
	id?: {
		type: string
		name: string
		start: number
		end: number
	}
	params?: ElementParams[]
	modifiers: InnerElement[]
	returnParams: ReturnParams
	body?: BodyElement[]
	literal: BodyLiteral
	storage_location: any | null
	start: number
	end: number
}
export type InnerElement = {
	type: string
	name: string
	id?: { type: string; name: string; start: number; end: number }
	params?: ElementParams[]
	modifiers: any[]
	returnParams: ReturnParams
	body?: BodyElement
	is_abstract: boolean
	start: number
	end: number
}
export type Element = {
	type: string
	name: string
	is?: any
	id?: { type: string; name: string; start: number; end: number }
	params?: ElementParams[]
	modifiers: InnerElement[]
	literal: BodyLiteral
	returnParams: ReturnParams
	body?: Element[]
	object?: any
	callee?: Element
	storage_location: any | null
	property?: InnerElement
	arguments?: InnerElement[]
	is_abstract: boolean
	start: number
	end: number
}
