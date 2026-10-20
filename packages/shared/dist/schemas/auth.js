"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Web3VerifySignatureSchema = exports.Web3AuthChallengeSchema = exports.LoginWithEmailSchema = void 0;
const zod_1 = require("zod");
exports.LoginWithEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
exports.Web3AuthChallengeSchema = zod_1.z.object({
    walletAddress: zod_1.z.string().min(10),
});
exports.Web3VerifySignatureSchema = zod_1.z.object({
    walletAddress: zod_1.z.string().min(10),
    signature: zod_1.z.string().min(10),
    nonce: zod_1.z.string().min(10),
});
//# sourceMappingURL=auth.js.map