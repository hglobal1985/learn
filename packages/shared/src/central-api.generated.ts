/** AUTO-GENERATED from hglobal1985/id openapi/hglobal-id.v1.json (2026-11-10.2).
 * Do not hand-edit. Central API JSON may contain additional fields. */
export type AppTokenPair = {
"token_type": "Bearer";
"access_token": string;
"expires_in": number;
"refresh_token": string;
"refresh_expires_in": number;
"scope": string;
};

export type AppSignIn = AppTokenPair & {
"user": {
"member_id": string;
"status": string;
"is_new": boolean;
};
};

export type AppConfig = {
"app_id": string;
"status": "active" | "paused" | "killed";
"min_version": string;
"config": {

[key: string]: unknown;
};
};

export type AppHandoff = {
"app_id": string;
"version": string;
"updated": string;
"integrated": string | null;
"up_to_date": boolean;
"text": string;
};

export type EligibilityRule = {
"audience": "hglobal_verified" | "everyone";
"min_rank"?: string | null;
};

export type EligibilityResult = {
"allowed": boolean;
"reason": "ok" | "not_verified" | "rank_too_low" | "amway_disabled";
};

export type Profile = {
"member_id": string;
"fields": {

[key: string]: {
"value": FieldValue;
"visibility": "public" | "private";
"updated_at": string | null;
"label"?: string;
"max_items"?: number;
"public_url"?: string | null;
};
};
"avatar": {
"url": string | null;
"source": "none" | "google" | "upload";
"always_public": true;
};
"info": {
"member_id": string;
"registration_country": string;
"account_status": string;
"zodiac": string | null;
"life_path_number": number | null;
"talent_number": string | null;
};
};

export type AmwayFieldDefinitions = {

[key: string]: unknown;
};

export type ErrorBody = {
"error": {
"code": string;
"message": string;
"request_id": string;
"details"?: {

[key: string]: unknown;
};
};
};

export type FieldValue = string | Array<string> | Array<MemberNumberEntry> | null | null;

export type MemberNumberEntry = {
"country": string;
"number": string;
};
