export type ISODateString = string;
export interface ScimMeta {
    resourceType: string;
    created: ISODateString;
    lastModified: ISODateString;
    location?: string;
    version?: string;
}
export interface ScimResource {
    schemas: string[];
    id: string;
    externalId?: string;
    meta?: ScimMeta;
}
export interface MultiValAttribute<T = unknown> {
    value?: T;
    display?: string;
    type?: string;
    primary?: boolean;
    $ref?: string;
}
export interface Address {
    type?: string;
    formatted?: string;
    streetAddress?: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    primary?: boolean;
}
export interface Name {
    formatted?: string;
    familyName?: string;
    givenName?: string;
    middleName?: string;
    honorificPrefix?: string;
    honorificSuffix?: string;
}
export interface User extends ScimResource {
    userName: string;
    name?: Name;
    displayName?: string;
    nickName?: string;
    profileUrl?: string;
    title?: string;
    userType?: string;
    preferredLanguage?: string;
    locale?: string;
    timezone?: string;
    active?: boolean;
    password?: string;
    emails?: Array<MultiValAttribute<string>>;
    phoneNumbers?: Array<MultiValAttribute<string>>;
    ims?: Array<MultiValAttribute<string>>;
    photos?: Array<MultiValAttribute<string>>;
    addresses?: Address[];
    groups?: Array<MultiValAttribute<string>>;
    entitlements?: Array<MultiValAttribute<string>>;
    roles?: Array<MultiValAttribute<string>>;
    x509Certificates?: Array<MultiValAttribute<string>>;
}
export interface GroupMember {
    value: string;
    $ref?: string;
    type?: 'User' | 'Group';
    display?: string;
}
export interface Group extends ScimResource {
    displayName: string;
    members?: GroupMember[];
}
export interface ServiceProviderConfig extends ScimResource {
    patch: {
        supported: boolean;
    };
    bulk: {
        supported: boolean;
        maxOperations?: number;
        maxPayloadSize?: number;
    };
    filter: {
        supported: boolean;
        maxResults?: number;
    };
    changePassword: {
        supported: boolean;
    };
    sort: {
        supported: boolean;
    };
    etag: {
        supported: boolean;
    };
    authenticationSchemes?: Array<{
        type: string;
        name: string;
        description?: string;
        specUri?: string;
        documentationUri?: string;
        primary?: boolean;
    }>;
}
export interface ResourceType extends ScimResource {
    name: string;
    endpoint: string;
    description?: string;
    schema: string;
    schemaExtensions?: Array<{
        schema: string;
        required: boolean;
    }>;
}
export interface SchemaAttribute {
    name: string;
    type: 'string' | 'boolean' | 'decimal' | 'integer' | 'dateTime' | 'reference' | 'binary' | 'complex';
    multiValued: boolean;
    description?: string;
    required?: boolean;
    canonicalValues?: string[];
    caseExact?: boolean;
    mutability?: 'readOnly' | 'readWrite' | 'immutable' | 'writeOnly';
    returned?: 'always' | 'never' | 'default' | 'request';
    uniqueness?: 'none' | 'server' | 'global';
    referenceTypes?: string[];
    subAttributes?: SchemaAttribute[];
}
export interface Schema extends ScimResource {
    id: string;
    name: string;
    description?: string;
    attributes: SchemaAttribute[];
}
export interface ListResponse<T = unknown> extends ScimResource {
    totalResults: number;
    startIndex: number;
    itemsPerPage: number;
    Resources: T[];
}
export interface ErrorResponse extends ScimResource {
    status: string;
    detail?: string;
    scimType?: string;
}
export type PatchOpAction = 'add' | 'remove' | 'replace';
export interface PatchOperation {
    op: PatchOpAction;
    path?: string;
    value?: any;
}
export interface PatchRequest extends ScimResource {
    Operations: PatchOperation[];
}
export interface SearchRequest extends ScimResource {
    filter?: string;
    sortBy?: string;
    sortOrder?: 'ascending' | 'descending';
    startIndex?: number;
    count?: number;
    attributes?: string[] | string;
    excludedAttributes?: string[] | string;
}
export declare const Schemas: {
    readonly ListResponse: "urn:ietf:params:scim:api:messages:2.0:ListResponse";
    readonly Error: "urn:ietf:params:scim:api:messages:2.0:Error";
    readonly PatchOp: "urn:ietf:params:scim:api:messages:2.0:PatchOp";
    readonly SearchRequest: "urn:ietf:params:scim:api:messages:2.0:SearchRequest";
    readonly ServiceProviderConfig: "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig";
    readonly ResourceType: "urn:ietf:params:scim:schemas:core:2.0:ResourceType";
    readonly Schema: "urn:ietf:params:scim:schemas:core:2.0:Schema";
    readonly User: "urn:ietf:params:scim:schemas:core:2.0:User";
    readonly Group: "urn:ietf:params:scim:schemas:core:2.0:Group";
};
export type CollectionName = 'users' | 'groups';
//# sourceMappingURL=types.d.ts.map