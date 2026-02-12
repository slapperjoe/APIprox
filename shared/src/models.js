"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidebarView = exports.PasswordType = exports.WSSecurityType = void 0;
// ============================================================================
// WS-SECURITY TYPES
// ============================================================================
var WSSecurityType;
(function (WSSecurityType) {
    WSSecurityType["None"] = "none";
    WSSecurityType["UsernameToken"] = "usernameToken";
    WSSecurityType["Certificate"] = "certificate";
})(WSSecurityType || (exports.WSSecurityType = WSSecurityType = {}));
var PasswordType;
(function (PasswordType) {
    PasswordType["PasswordText"] = "PasswordText";
    PasswordType["PasswordDigest"] = "PasswordDigest";
})(PasswordType || (exports.PasswordType = PasswordType = {}));
var SidebarView;
(function (SidebarView) {
    SidebarView["HOME"] = "home";
    SidebarView["PROJECTS"] = "projects";
    SidebarView["COLLECTIONS"] = "collections";
    SidebarView["EXPLORER"] = "explorer";
    SidebarView["TESTS"] = "tests";
    SidebarView["WORKFLOWS"] = "workflows";
    SidebarView["WATCHER"] = "watcher";
    SidebarView["SERVER"] = "server";
    SidebarView["PERFORMANCE"] = "performance";
    SidebarView["HISTORY"] = "history";
})(SidebarView || (exports.SidebarView = SidebarView = {}));
