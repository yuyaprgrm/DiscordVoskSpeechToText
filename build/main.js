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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
const commands_1 = require("./commands");
dotenv_1.default.config();
const client = new discord_js_1.Client({
    intents: [discord_js_1.GatewayIntentBits.Guilds | discord_js_1.GatewayIntentBits.GuildVoiceStates | discord_js_1.GatewayIntentBits.GuildWebhooks],
});
client.once(discord_js_1.Events.ClientReady, () => {
    console.log('Ready!');
    console.log(client.user.tag);
});
const joinCommand = new commands_1.JoinCommand();
const byeCommand = new commands_1.ByeCommand();
client.on(discord_js_1.Events.InteractionCreate, (interaction) => __awaiter(void 0, void 0, void 0, function* () {
    if (!interaction.isChatInputCommand())
        return;
    switch (interaction.commandName) {
        case 'join':
            joinCommand.execute(interaction);
            break;
        case 'bye':
            byeCommand.execute(interaction);
            break;
    }
}));
client.login(process.env.TOKEN);
