import type { NextFunction, Request, Response } from 'express';
import { ObjectId, type WithId } from 'mongodb';
import { type ErrorResponse, type ListResponse, type ScimMeta } from './types.js';
export declare const SCIM_CONTENT_TYPE = "application/scim+json";
export declare function nowIso(): string;
export declare function makeMeta(resourceType: string, id: string, baseUrl: string, versionNum: number, created?: string): ScimMeta;
export declare function toScim<T extends {
    _id?: ObjectId;
    meta?: ScimMeta;
    _version?: number;
}>(resourceType: string, doc: WithId<any> | any, baseUrl: string): any;
export declare function listResponse<T>(baseUrl: string, resourceType: string, resources: any[], totalResults: number, startIndex: number, count: number): ListResponse<T>;
export declare function error(status: number, detail: string, scimType?: string): ErrorResponse;
export declare function sendError(res: Response, status: number, detail: string, scimType?: string): void;
export declare function requireBearer(token?: string): (req: Request, res: Response, next: NextFunction) => void;
export declare function baseUrlFrom(req: Request): string;
export declare function scimFilterToMongo(filter?: string): any;
export declare function etagNumberFrom(header?: string): number | undefined;
export declare function checkIfMatch(req: Request, currentVersion: number): boolean;
export declare function parseListParams(req: Request): {
    startIndex: number;
    count: number;
    filter: string;
    sortBy: string;
    sortOrder?: 1 | -1;
};
export declare function asObjectId(id: string): ObjectId;
export declare function setCommonHeaders(res: Response): void;
//# sourceMappingURL=util.d.ts.map