/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	Conversations: "conversations",
	McpActivity: "mcp_activity",
	McpClients: "mcp_clients",
	McpGrants: "mcp_grants",
	Posts: "posts",
	Users: "users",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type ConversationsRecord<Tmessages = unknown> = {
	created: IsoAutoDateString
	id: string
	messages?: null | Tmessages
	title?: string
	updated: IsoAutoDateString
	user: RecordIdString
}

export const McpActivityOutcomeOptions = {
	"ok": "ok",
	"denied": "denied",
	"error": "error",
} as const
export type McpActivityOutcomeOptions = typeof McpActivityOutcomeOptions[keyof typeof McpActivityOutcomeOptions]
export type McpActivityRecord = {
	clientName?: string
	created: IsoAutoDateString
	grant?: string
	id: string
	outcome: McpActivityOutcomeOptions
	tool?: string
	updated: IsoAutoDateString
	user: RecordIdString
}

export type McpClientsRecord<TredirectUris = unknown> = {
	clientId: string
	created: IsoAutoDateString
	id: string
	name: string
	redirectUris?: null | TredirectUris
	updated: IsoAutoDateString
	used?: boolean
}

export const McpGrantsKindOptions = {
	"oauth": "oauth",
	"token": "token",
} as const
export type McpGrantsKindOptions = typeof McpGrantsKindOptions[keyof typeof McpGrantsKindOptions]

export const McpGrantsStatusOptions = {
	"pending": "pending",
	"active": "active",
} as const
export type McpGrantsStatusOptions = typeof McpGrantsStatusOptions[keyof typeof McpGrantsStatusOptions]
export type McpGrantsRecord<Tscopes = unknown> = {
	accessExpires?: IsoDateString
	accessHash?: string
	clientHost?: string
	clientId?: string
	clientName?: string
	codeChallenge?: string
	codeExpires?: IsoDateString
	codeHash?: string
	created: IsoAutoDateString
	expires?: IsoDateString
	id: string
	kind: McpGrantsKindOptions
	lastUsed?: IsoDateString
	previousRefreshHash?: string
	redirectUri?: string
	refreshHash?: string
	scopes?: null | Tscopes
	status: McpGrantsStatusOptions
	updated: IsoAutoDateString
	user: RecordIdString
	verified?: boolean
}

export type PostsRecord = {
	author: RecordIdString
	content?: string
	created: IsoAutoDateString
	id: string
	published?: boolean
	slug: string
	title: string
	updated: IsoAutoDateString
}

export const UsersLocaleOptions = {
	"en": "en",
	"de": "de",
} as const
export type UsersLocaleOptions = typeof UsersLocaleOptions[keyof typeof UsersLocaleOptions]

export const UsersTwoFactorOptions = {
	"app": "app",
	"email": "email",
} as const
export type UsersTwoFactorOptions = typeof UsersTwoFactorOptions[keyof typeof UsersTwoFactorOptions]
export type UsersRecord<TrecoveryCodes = unknown> = {
	avatar?: FileNameString
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	firstName?: string
	id: string
	lastName?: string
	locale?: UsersLocaleOptions
	name?: string
	password: string
	recoveryCodes?: null | TrecoveryCodes
	tokenKey: string
	totpFailures?: number
	totpLastStep?: number
	totpPending?: string
	totpSecret?: string
	twoFactor?: UsersTwoFactorOptions
	updated: IsoAutoDateString
	verified?: boolean
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type ConversationsResponse<Tmessages = unknown, Texpand = unknown> = Required<ConversationsRecord<Tmessages>> & BaseSystemFields<Texpand>
export type McpActivityResponse<Texpand = unknown> = Required<McpActivityRecord> & BaseSystemFields<Texpand>
export type McpClientsResponse<TredirectUris = unknown, Texpand = unknown> = Required<McpClientsRecord<TredirectUris>> & BaseSystemFields<Texpand>
export type McpGrantsResponse<Tscopes = unknown, Texpand = unknown> = Required<McpGrantsRecord<Tscopes>> & BaseSystemFields<Texpand>
export type PostsResponse<Texpand = unknown> = Required<PostsRecord> & BaseSystemFields<Texpand>
export type UsersResponse<TrecoveryCodes = unknown, Texpand = unknown> = Required<UsersRecord<TrecoveryCodes>> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	conversations: ConversationsRecord
	mcp_activity: McpActivityRecord
	mcp_clients: McpClientsRecord
	mcp_grants: McpGrantsRecord
	posts: PostsRecord
	users: UsersRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	conversations: ConversationsResponse
	mcp_activity: McpActivityResponse
	mcp_clients: McpClientsResponse
	mcp_grants: McpGrantsResponse
	posts: PostsResponse
	users: UsersResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
