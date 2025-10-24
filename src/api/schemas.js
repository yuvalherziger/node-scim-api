import { Router } from 'express';
import { Schemas } from './types.js';
import { SCIM_CONTENT_TYPE } from './util.js';
export const schemasRouter = Router();
const userAttributes = [
    {
        name: 'userName',
        type: 'string',
        multiValued: false,
        description: 'Unique identifier for the User',
        required: true,
        caseExact: false,
        uniqueness: 'server'
    },
    {
        name: 'name', type: 'complex', multiValued: false, subAttributes: [
            { name: 'formatted', type: 'string', multiValued: false },
            { name: 'familyName', type: 'string', multiValued: false },
            { name: 'givenName', type: 'string', multiValued: false },
            { name: 'middleName', type: 'string', multiValued: false },
            { name: 'honorificPrefix', type: 'string', multiValued: false },
            { name: 'honorificSuffix', type: 'string', multiValued: false },
        ]
    },
    { name: 'displayName', type: 'string', multiValued: false },
    { name: 'nickName', type: 'string', multiValued: false },
    { name: 'profileUrl', type: 'string', multiValued: false },
    { name: 'title', type: 'string', multiValued: false },
    { name: 'userType', type: 'string', multiValued: false },
    { name: 'preferredLanguage', type: 'string', multiValued: false },
    { name: 'locale', type: 'string', multiValued: false },
    { name: 'timezone', type: 'string', multiValued: false },
    { name: 'active', type: 'boolean', multiValued: false },
    { name: 'password', type: 'string', multiValued: false, mutability: 'writeOnly' },
    {
        name: 'emails', type: 'complex', multiValued: true, subAttributes: [
            { name: 'value', type: 'string', multiValued: false },
            { name: 'type', type: 'string', multiValued: false },
            { name: 'primary', type: 'boolean', multiValued: false },
        ]
    },
    {
        name: 'phoneNumbers', type: 'complex', multiValued: true, subAttributes: [
            { name: 'value', type: 'string', multiValued: false },
            { name: 'type', type: 'string', multiValued: false },
            { name: 'primary', type: 'boolean', multiValued: false },
        ]
    },
    {
        name: 'addresses', type: 'complex', multiValued: true, subAttributes: [
            { name: 'type', type: 'string', multiValued: false },
            { name: 'formatted', type: 'string', multiValued: false },
            { name: 'streetAddress', type: 'string', multiValued: false },
            { name: 'locality', type: 'string', multiValued: false },
            { name: 'region', type: 'string', multiValued: false },
            { name: 'postalCode', type: 'string', multiValued: false },
            { name: 'country', type: 'string', multiValued: false },
            { name: 'primary', type: 'boolean', multiValued: false },
        ]
    },
    {
        name: 'groups', type: 'complex', multiValued: true, mutability: 'readOnly', subAttributes: [
            { name: 'value', type: 'string', multiValued: false },
            { name: '$ref', type: 'reference', multiValued: false, referenceTypes: ['User', 'Group'] },
            { name: 'display', type: 'string', multiValued: false },
            { name: 'type', type: 'string', multiValued: false },
        ]
    },
    {
        name: 'entitlements', type: 'complex', multiValued: true, subAttributes: [
            { name: 'value', type: 'string', multiValued: false },
            { name: 'display', type: 'string', multiValued: false },
            { name: 'type', type: 'string', multiValued: false },
            { name: 'primary', type: 'boolean', multiValued: false },
        ]
    },
    {
        name: 'roles', type: 'complex', multiValued: true, subAttributes: [
            { name: 'value', type: 'string', multiValued: false },
            { name: 'display', type: 'string', multiValued: false },
            { name: 'type', type: 'string', multiValued: false },
            { name: 'primary', type: 'boolean', multiValued: false },
        ]
    },
    {
        name: 'x509Certificates', type: 'complex', multiValued: true, subAttributes: [
            { name: 'value', type: 'binary', multiValued: false },
            { name: 'display', type: 'string', multiValued: false },
            { name: 'type', type: 'string', multiValued: false },
            { name: 'primary', type: 'boolean', multiValued: false },
        ]
    },
];
const groupAttributes = [
    { name: 'displayName', type: 'string', multiValued: false, required: true },
    {
        name: 'members', type: 'complex', multiValued: true, subAttributes: [
            { name: 'value', type: 'string', multiValued: false },
            { name: '$ref', type: 'reference', multiValued: false, referenceTypes: ['User', 'Group'] },
            { name: 'display', type: 'string', multiValued: false },
            { name: 'type', type: 'string', multiValued: false },
        ]
    },
];
const userSchema = {
    schemas: [Schemas.Schema],
    id: Schemas.User,
    name: 'User',
    description: 'User Account',
    attributes: userAttributes,
};
const groupSchema = {
    schemas: [Schemas.Schema],
    id: Schemas.Group,
    name: 'Group',
    description: 'Group',
    attributes: groupAttributes,
};
const byId = {
    [Schemas.User]: userSchema,
    [Schemas.Group]: groupSchema,
};
schemasRouter.get('/Schemas', (_req, res) => {
    res.type(SCIM_CONTENT_TYPE).send([userSchema, groupSchema]);
});
schemasRouter.get('/Schemas/:id', (req, res) => {
    let s;
    if (req?.params?.id) {
        s = byId[req.params.id];
    }
    if (!s)
        return res.status(404).type(SCIM_CONTENT_TYPE).send({
            schemas: [Schemas.Error],
            status: '404',
            detail: 'Schema not found'
        });
    res.type(SCIM_CONTENT_TYPE).send(s);
});
//# sourceMappingURL=schemas.js.map