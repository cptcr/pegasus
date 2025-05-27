"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/deploy-commands.ts - Deploy Commands to Discord
var discord_js_1 = require("discord.js");
var fs_1 = require("fs");
var path_1 = require("path");
require("dotenv/config");
var commands = [];
var commandsPath = (0, path_1.join)(process.cwd(), 'src', 'commands');
var commandFolders = (0, fs_1.readdirSync)(commandsPath);
console.log('🔄 Loading commands...');
for (var _i = 0, commandFolders_1 = commandFolders; _i < commandFolders_1.length; _i++) {
    var folder = commandFolders_1[_i];
    var folderPath = (0, path_1.join)(commandsPath, folder);
    var commandFiles = (0, fs_1.readdirSync)(folderPath).filter(function (file) { return file.endsWith('.ts') || file.endsWith('.js'); });
    for (var _a = 0, commandFiles_1 = commandFiles; _a < commandFiles_1.length; _a++) {
        var file = commandFiles_1[_a];
        var filePath = (0, path_1.join)(folderPath, file);
        try {
            var command = (await Promise.resolve("".concat("file://".concat(filePath))).then(function (s) { return require(s); })).default;
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log("\u2705 Loaded command: /".concat(command.data.name));
            }
            else {
                console.log("\u26A0\uFE0F [WARNING] The command at ".concat(filePath, " is missing a required \"data\" or \"execute\" property."));
            }
        }
        catch (error) {
            console.log("\u274C [ERROR] Failed to load command at ".concat(filePath, ":"), error);
        }
    }
}
var rest = new discord_js_1.REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var clientId, guildId, data, data, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                console.log("\uD83D\uDE80 Started refreshing ".concat(commands.length, " application (/) commands."));
                clientId = process.env.DISCORD_CLIENT_ID;
                guildId = process.env.TARGET_GUILD_ID;
                if (!guildId) return [3 /*break*/, 2];
                return [4 /*yield*/, rest.put(discord_js_1.Routes.applicationGuildCommands(clientId, guildId), { body: commands })];
            case 1:
                data = _a.sent();
                console.log("\u2705 Successfully reloaded ".concat(data.length, " guild application (/) commands for guild ").concat(guildId, "."));
                return [3 /*break*/, 4];
            case 2: return [4 /*yield*/, rest.put(discord_js_1.Routes.applicationCommands(clientId), { body: commands })];
            case 3:
                data = _a.sent();
                console.log("\u2705 Successfully reloaded ".concat(data.length, " global application (/) commands."));
                _a.label = 4;
            case 4: return [3 /*break*/, 6];
            case 5:
                error_1 = _a.sent();
                console.error('❌ Error deploying commands:', error_1);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); })();
