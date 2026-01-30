"use strict";
/**
 * PointHub Integration Module
 * 포인트허브 API 연동 모듈
 *
 * 주요 기능:
 * 1. 회원 확인: 포인트허브 회원 여부 조회 및 게임 계정 연동
 * 2. Gpoint 출금: 포인트허브 → 게임 (6시간 배치)
 * 3. GPorder 입금: 게임 → 포인트허브 (6시간 배치)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBatchStatus = exports.manualGporderTransfer = exports.manualGpointWithdraw = exports.gporderTransferScheduler = exports.gpointWithdrawScheduler = exports.testGporderTransfer = exports.onGoldenBellNoWinner = exports.onGameProfit = exports.runGporderBatchTransfer = exports.recordGameSales2 = exports.recordGameSales1 = exports.saveGameRevenue = exports.transferGporders = exports.getGpointBalance = exports.runGpointBatchWithdraw = exports.processGpointWithdrawals = exports.withdrawGpoints = exports.selectGpoints = exports.getPointHubLinkStatus = exports.verifyPointHubMember = exports.getGameUidByPointHubMember = exports.getLinkedPointHubMember = exports.linkPointHubMember = exports.checkPointHubMember = exports.getDateRangeForBatch = exports.generateOrderNum = exports.callPointHubAPIJson = exports.callPointHubAPI = exports.getUnixTimestamp = exports.generateHeaders = exports.sha256Hash = exports.generateSignature = exports.GPORDER_TYPES = exports.TRANS_CODES = exports.POINTHUB_ENDPOINTS = exports.POINTHUB_CONFIG = void 0;
// Configuration
var config_1 = require("./config");
Object.defineProperty(exports, "POINTHUB_CONFIG", { enumerable: true, get: function () { return config_1.POINTHUB_CONFIG; } });
Object.defineProperty(exports, "POINTHUB_ENDPOINTS", { enumerable: true, get: function () { return config_1.POINTHUB_ENDPOINTS; } });
Object.defineProperty(exports, "TRANS_CODES", { enumerable: true, get: function () { return config_1.TRANS_CODES; } });
Object.defineProperty(exports, "GPORDER_TYPES", { enumerable: true, get: function () { return config_1.GPORDER_TYPES; } });
// Authentication
var auth_1 = require("./auth");
Object.defineProperty(exports, "generateSignature", { enumerable: true, get: function () { return auth_1.generateSignature; } });
Object.defineProperty(exports, "sha256Hash", { enumerable: true, get: function () { return auth_1.sha256Hash; } });
Object.defineProperty(exports, "generateHeaders", { enumerable: true, get: function () { return auth_1.generateHeaders; } });
Object.defineProperty(exports, "getUnixTimestamp", { enumerable: true, get: function () { return auth_1.getUnixTimestamp; } });
// API Client
var api_client_1 = require("./api-client");
Object.defineProperty(exports, "callPointHubAPI", { enumerable: true, get: function () { return api_client_1.callPointHubAPI; } });
Object.defineProperty(exports, "callPointHubAPIJson", { enumerable: true, get: function () { return api_client_1.callPointHubAPIJson; } });
Object.defineProperty(exports, "generateOrderNum", { enumerable: true, get: function () { return api_client_1.generateOrderNum; } });
Object.defineProperty(exports, "getDateRangeForBatch", { enumerable: true, get: function () { return api_client_1.getDateRangeForBatch; } });
// Member API
var member_1 = require("./member");
Object.defineProperty(exports, "checkPointHubMember", { enumerable: true, get: function () { return member_1.checkPointHubMember; } });
Object.defineProperty(exports, "linkPointHubMember", { enumerable: true, get: function () { return member_1.linkPointHubMember; } });
Object.defineProperty(exports, "getLinkedPointHubMember", { enumerable: true, get: function () { return member_1.getLinkedPointHubMember; } });
Object.defineProperty(exports, "getGameUidByPointHubMember", { enumerable: true, get: function () { return member_1.getGameUidByPointHubMember; } });
Object.defineProperty(exports, "verifyPointHubMember", { enumerable: true, get: function () { return member_1.verifyPointHubMember; } });
Object.defineProperty(exports, "getPointHubLinkStatus", { enumerable: true, get: function () { return member_1.getPointHubLinkStatus; } });
// Gpoint API
var gpoint_1 = require("./gpoint");
Object.defineProperty(exports, "selectGpoints", { enumerable: true, get: function () { return gpoint_1.selectGpoints; } });
Object.defineProperty(exports, "withdrawGpoints", { enumerable: true, get: function () { return gpoint_1.withdrawGpoints; } });
Object.defineProperty(exports, "processGpointWithdrawals", { enumerable: true, get: function () { return gpoint_1.processGpointWithdrawals; } });
Object.defineProperty(exports, "runGpointBatchWithdraw", { enumerable: true, get: function () { return gpoint_1.runGpointBatchWithdraw; } });
Object.defineProperty(exports, "getGpointBalance", { enumerable: true, get: function () { return gpoint_1.getGpointBalance; } });
// GPorder API
var gporder_1 = require("./gporder");
Object.defineProperty(exports, "transferGporders", { enumerable: true, get: function () { return gporder_1.transferGporders; } });
Object.defineProperty(exports, "saveGameRevenue", { enumerable: true, get: function () { return gporder_1.saveGameRevenue; } });
Object.defineProperty(exports, "recordGameSales1", { enumerable: true, get: function () { return gporder_1.recordGameSales1; } });
Object.defineProperty(exports, "recordGameSales2", { enumerable: true, get: function () { return gporder_1.recordGameSales2; } });
Object.defineProperty(exports, "runGporderBatchTransfer", { enumerable: true, get: function () { return gporder_1.runGporderBatchTransfer; } });
Object.defineProperty(exports, "onGameProfit", { enumerable: true, get: function () { return gporder_1.onGameProfit; } });
Object.defineProperty(exports, "onGoldenBellNoWinner", { enumerable: true, get: function () { return gporder_1.onGoldenBellNoWinner; } });
Object.defineProperty(exports, "testGporderTransfer", { enumerable: true, get: function () { return gporder_1.testGporderTransfer; } });
// Schedulers
var scheduler_1 = require("./scheduler");
Object.defineProperty(exports, "gpointWithdrawScheduler", { enumerable: true, get: function () { return scheduler_1.gpointWithdrawScheduler; } });
Object.defineProperty(exports, "gporderTransferScheduler", { enumerable: true, get: function () { return scheduler_1.gporderTransferScheduler; } });
Object.defineProperty(exports, "manualGpointWithdraw", { enumerable: true, get: function () { return scheduler_1.manualGpointWithdraw; } });
Object.defineProperty(exports, "manualGporderTransfer", { enumerable: true, get: function () { return scheduler_1.manualGporderTransfer; } });
Object.defineProperty(exports, "getBatchStatus", { enumerable: true, get: function () { return scheduler_1.getBatchStatus; } });
//# sourceMappingURL=index.js.map