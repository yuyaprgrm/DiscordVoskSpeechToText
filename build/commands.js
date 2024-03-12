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
exports.ByeCommand = exports.JoinCommand = exports.BaseCommand = void 0;
const discord_js_1 = require("discord.js");
const voice_1 = require("@discordjs/voice");
const opus_1 = require("@discordjs/opus");
const child_process_1 = require("child_process");
const dotenv_1 = __importDefault(require("dotenv"));
const microsoft_cognitiveservices_speech_sdk_1 = require("microsoft-cognitiveservices-speech-sdk");
class BaseCommand {
}
exports.BaseCommand = BaseCommand;
const BufferSize = 4000;
const SampleRate = 16000;
dotenv_1.default.config();
const speechConfig = microsoft_cognitiveservices_speech_sdk_1.SpeechConfig.fromSubscription(process.env.SPEECH_KEY, process.env.SPEECH_REGION);
speechConfig.speechRecognitionLanguage = "ja-JP";
class JoinCommand extends BaseCommand {
    constructor() {
        super(...arguments);
        this.cacheWebhooks = new Map();
    }
    execute(interaction) {
        return __awaiter(this, void 0, void 0, function* () {
            if (interaction.guild === null || !(interaction.member instanceof discord_js_1.GuildMember)) {
                interaction.reply('command is only available in guild');
                return;
            }
            const guild = interaction.guild;
            const member = interaction.member;
            const commandVChannel = interaction.options.getChannel('vc', false);
            if (commandVChannel !== null && !(commandVChannel instanceof discord_js_1.VoiceChannel)) {
                interaction.reply({ content: '不明なエラーです', ephemeral: true });
                return;
            }
            const vchannel = commandVChannel !== null && commandVChannel !== void 0 ? commandVChannel : member.voice.channel;
            if (vchannel === null) {
                interaction.reply({ content: 'vcが指定されていません', ephemeral: true });
                return;
            }
            if (!(interaction.channel instanceof discord_js_1.TextChannel)) {
                interaction.reply({ content: 'テキストチャンネル以外で使用できません', ephemeral: true });
                return;
            }
            const tchannel = interaction.channel;
            if (!vchannel.joinable) {
                interaction.reply({ content: 'vcに接続できません', ephemeral: true });
                return;
            }
            const prevConnection = (0, voice_1.getVoiceConnection)(interaction.guild.id);
            if (prevConnection !== undefined) {
                prevConnection.destroy();
            }
            const connection = (0, voice_1.joinVoiceChannel)({
                channelId: vchannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false
            });
            // const webhook = await this.getWebhook(tchannel)
            const speakingLock = new Map;
            connection.receiver.speaking.on("start", (userId) => __awaiter(this, void 0, void 0, function* () {
                const member = yield guild.members.fetch(userId);
                if (speakingLock.has(userId) || member.user.bot) {
                    return;
                }
                speakingLock.set(userId, 0);
                // tchannel.sendTyping()
                const audioStream = connection.receiver.subscribe(userId, {
                    end: {
                        behavior: voice_1.EndBehaviorType.AfterSilence,
                        duration: 1000
                    }
                });
                const encoder = new opus_1.OpusEncoder(48000, 2);
                const ffmpeg_run = (0, child_process_1.spawn)('ffmpeg', ['-loglevel', 'quiet', '-ar', '48000', '-ac', '2', '-f', 's16le', '-i', 'pipe:',
                    '-ar', String(SampleRate), '-ac', '1',
                    '-f', 's16le', '-bufsize', String(BufferSize), '-']);
                let pushStream = microsoft_cognitiveservices_speech_sdk_1.AudioInputStream.createPushStream();
                let audioConfig = microsoft_cognitiveservices_speech_sdk_1.AudioConfig.fromStreamInput(pushStream);
                let output = "";
                ffmpeg_run.stdout.on('data', (stdout) => {
                    pushStream.write(stdout);
                });
                ffmpeg_run.stdout.on("end", () => {
                    pushStream.close();
                });
                audioStream.on("data", chunk => {
                    ffmpeg_run.stdin.write(encoder.decode(chunk));
                });
                audioStream.on("end", () => __awaiter(this, void 0, void 0, function* () {
                    ffmpeg_run.stdin.end();
                    speakingLock.delete(userId);
                }));
                let speechRecognizer = new microsoft_cognitiveservices_speech_sdk_1.SpeechRecognizer(speechConfig, audioConfig);
                speechRecognizer.recognizeOnceAsync((result) => {
                    if (result.text !== undefined) {
                        tchannel.send(member.displayName + ":" + result.text);
                    }
                    speechRecognizer.close();
                });
            }));
            interaction.reply('vcに接続完了しました。音声認識を開始します。');
        });
    }
    getWebhook(tchannel) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const webhook = (_a = this.cacheWebhooks.get(tchannel.id)) !== null && _a !== void 0 ? _a : yield this.fetchWebhook(tchannel);
            return webhook;
        });
    }
    fetchWebhook(tchannel) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const webhooks = yield tchannel.fetchWebhooks();
            const webhook = (_a = webhooks === null || webhooks === void 0 ? void 0 : webhooks.find((v) => v.token)) !== null && _a !== void 0 ? _a : yield tchannel.createWebhook({
                name: "VS2T bot Webhook",
                reason: "webhook for Vosk Speech To Text bot to post message as if by user."
            });
            if (webhook)
                this.cacheWebhooks.set(tchannel.id, webhook);
            return webhook;
        });
    }
}
exports.JoinCommand = JoinCommand;
JoinCommand.commandJson = new discord_js_1.SlashCommandBuilder()
    .setName('join')
    .setDescription('start translating speech to text.')
    .addChannelOption(option => option
    .setName('vc')
    .setDescription('voice channel to join')
    .setRequired(false)
    .addChannelTypes(discord_js_1.ChannelType.GuildVoice))
    .toJSON();
class ByeCommand extends BaseCommand {
    execute(interaction) {
        if (interaction.guild === null) {
            interaction.reply('command is only available in guild');
            return;
        }
        const connection = (0, voice_1.getVoiceConnection)(interaction.guild.id);
        if (connection === undefined) {
            interaction.reply({ content: 'vcに接続していません', ephemeral: true });
            return;
        }
        connection.disconnect();
        interaction.reply('vcから切断されました。音声認識を終了します。');
    }
}
exports.ByeCommand = ByeCommand;
ByeCommand.commandJson = new discord_js_1.SlashCommandBuilder()
    .setName('bye')
    .setDescription('end translating speech to text.')
    .toJSON();
