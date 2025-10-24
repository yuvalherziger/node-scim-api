import { Router } from 'express';
import { Schemas } from './types.js';
import { SCIM_CONTENT_TYPE } from './util.js';
export const resourceTypesRouter = Router();
const usersType = {
    schemas: [Schemas.ResourceType],
    id: 'Users',
    name: 'User',
    endpoint: '/Users',
    description: 'User Account',
    schema: Schemas.User,
};
const groupsType = {
    schemas: [Schemas.ResourceType],
    id: 'Groups',
    name: 'Group',
    endpoint: '/Groups',
    description: 'Group',
    schema: Schemas.Group,
};
const map = {
    Users: usersType,
    Groups: groupsType,
};
resourceTypesRouter.get('/ResourceTypes', (_req, res) => {
    res.type(SCIM_CONTENT_TYPE).send([usersType, groupsType]);
});
resourceTypesRouter.get('/ResourceTypes/:id', (req, res) => {
    let r;
    if (req.params.id) {
        r = map[req.params.id];
    }
    if (!r) {
        return res.status(404).type(SCIM_CONTENT_TYPE).send({
            schemas: [Schemas.Error],
            status: '404',
            detail: 'ResourceType not found'
        });
    }
    res.type(SCIM_CONTENT_TYPE).send(r);
});
//# sourceMappingURL=resource-type.js.map