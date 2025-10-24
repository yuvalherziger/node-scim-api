import express from 'express';
import { client } from './common/db.js';
import { requireBearer, SCIM_CONTENT_TYPE } from './api/util.js';
import { serviceProviderConfigRouter } from './api/service-provider-config.js';
import { schemasRouter } from './api/schemas.js';
import { resourceTypesRouter } from './api/resource-type.js';
import { usersRouter } from './api/users.js';
import { groupsRouter } from './api/group.js';
import { searchRouter } from './api/search.js';
import { bulkRouter } from './api/bulk.js';
import { selfRouter } from './api/self.js';
const app = express();
app.use(express.json({ type: [SCIM_CONTENT_TYPE, 'application/json'] }));
const token = process.env.SCIM_BEARER_TOKEN;
app.use(requireBearer(token));
app.use('/', serviceProviderConfigRouter);
app.use('/', schemasRouter);
app.use('/', resourceTypesRouter);
app.use('/', usersRouter);
app.use('/', groupsRouter);
app.use('/', searchRouter);
app.use('/', bulkRouter);
app.use('/', selfRouter);
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).type(SCIM_CONTENT_TYPE).send({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: '500', detail: 'Internal Server Error' });
});
const PORT = Number(process.env.PORT || 3000);
async function start() {
    await client.connect();
    app.listen(PORT, () => {
        console.log(`SCIM server listening on :${PORT}`);
    });
}
if (process.env.NODE_ENV !== 'test') {
    start().catch((e) => {
        console.error('Failed to start server', e);
        process.exit(1);
    });
}
export default app;
//# sourceMappingURL=index.js.map