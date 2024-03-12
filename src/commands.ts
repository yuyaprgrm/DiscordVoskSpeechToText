import { CacheType, ChannelType, ChatInputCommandInteraction, CommandInteraction, GuildMember, RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder, Snowflake, TextBasedChannel, TextChannel, VoiceChannel, Webhook } from "discord.js";
import { joinVoiceChannel, AudioReceiveStream, EndBehaviorType, getVoiceConnection } from '@discordjs/voice';
import { OpusEncoder } from '@discordjs/opus';
import { spawn } from 'child_process';
import dotenv from 'dotenv'
import { AudioConfig, AudioInputStream, SpeechConfig, SpeechRecognizer } from 'microsoft-cognitiveservices-speech-sdk';
import fs from 'node:fs';

export abstract class BaseCommand {
    public static commandJson: RESTPostAPIApplicationCommandsJSONBody;
    public abstract execute(interaction: CommandInteraction): void;
}

const BufferSize = 4000
const SampleRate = 16000

dotenv.config()
const speechConfig = SpeechConfig.fromSubscription(process.env.SPEECH_KEY!, process.env.SPEECH_REGION!);
speechConfig.speechRecognitionLanguage = "ja-JP";

export class JoinCommand extends BaseCommand{

    public static commandJson: RESTPostAPIApplicationCommandsJSONBody =
        new SlashCommandBuilder()
            .setName('join')
            .setDescription('start translating speech to text.')
            .addChannelOption(option => option
                .setName('vc')
                .setDescription('voice channel to join')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildVoice)
            )
            .toJSON()

    private cacheWebhooks = new Map<Snowflake, Webhook>();
    
    public async execute(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        if (interaction.guild === null || !(interaction.member instanceof GuildMember)) {
            interaction.reply('command is only available in guild')
            return
        }

        const guild = interaction.guild
        const member = interaction.member

        const commandVChannel = interaction.options.getChannel('vc', false)
        if (commandVChannel !== null && !(commandVChannel instanceof VoiceChannel)) {
            interaction.reply({ content: '不明なエラーです', ephemeral: true })
            return
        }
        const vchannel = commandVChannel ?? member.voice.channel 
        if (vchannel === null) {
            interaction.reply({ content: 'vcが指定されていません', ephemeral: true })
            return
        }

        if (!(interaction.channel instanceof TextChannel)) {
            interaction.reply({ content: 'テキストチャンネル以外で使用できません', ephemeral: true })
            return
        }

        const tchannel = interaction.channel

        if (!vchannel.joinable) {
            interaction.reply({ content: 'vcに接続できません', ephemeral: true })
            return
        }

        const prevConnection = getVoiceConnection(interaction.guild.id)
        if (prevConnection !== undefined) {
            prevConnection.destroy()
        }

        const connection = joinVoiceChannel({
            channelId: vchannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false
        })

        // const webhook = await this.getWebhook(tchannel)

        const speakingLock = new Map<string, 0>
        
        connection.receiver.speaking.on("start", async userId => {
            const member = await guild.members.fetch(userId);

            if (speakingLock.has(userId) || member.user.bot) {
                return;
            }
            speakingLock.set(userId, 0)

            // tchannel.sendTyping()

            const audioStream = connection.receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 1000
                }
            })
            

            const encoder = new OpusEncoder(48000, 2)

            const ffmpeg_run = spawn('ffmpeg', ['-loglevel', 'quiet', '-ar', '48000', '-ac', '2', '-f', 's16le', '-i', 'pipe:',
                '-ar', String(SampleRate), '-ac', '1',
                '-f', 's16le', '-bufsize', String(BufferSize), '-']);

            let pushStream = AudioInputStream.createPushStream()
            let audioConfig = AudioConfig.fromStreamInput(pushStream)
            let output = ""
            ffmpeg_run.stdout.on('data', (stdout) => {
                pushStream.write(stdout)
            })

            ffmpeg_run.stdout.on("end", () => {
                pushStream.close()
            })

            audioStream.on("data", chunk => {
                ffmpeg_run.stdin.write(encoder.decode(chunk))
            })

            audioStream.on("end", async () => {
                ffmpeg_run.stdin.end()
                speakingLock.delete(userId)
            })

            
            let speechRecognizer = new SpeechRecognizer(speechConfig, audioConfig)

            speechRecognizer.recognizeOnceAsync((result) => {
                if(result.text !== undefined){
                    tchannel.send(member.displayName + ":" + result.text)
                }
                speechRecognizer.close()
            });
        
        })

        interaction.reply('vcに接続完了しました。音声認識を開始します。')
    }

    private async getWebhook(tchannel: TextChannel): Promise<Webhook> {
        const webhook = this.cacheWebhooks.get(tchannel.id) ?? await this.fetchWebhook(tchannel)
        return webhook
    }

    private async fetchWebhook(tchannel: TextChannel): Promise<Webhook> {
        const webhooks = await tchannel.fetchWebhooks();
        const webhook = webhooks?.find((v) => v.token) ?? await tchannel.createWebhook({
            name: "VS2T bot Webhook",
            reason: "webhook for Vosk Speech To Text bot to post message as if by user."
        });
        if (webhook) this.cacheWebhooks.set(tchannel.id, webhook);
        return webhook;
    }
}

export class ByeCommand extends BaseCommand {
    public static commandJson: RESTPostAPIApplicationCommandsJSONBody =
        new SlashCommandBuilder()
            .setName('bye')
            .setDescription('end translating speech to text.')
            .toJSON()
    
    public execute(interaction: CommandInteraction<CacheType>): void {
        if (interaction.guild === null) {
            interaction.reply('command is only available in guild')
            return
        }
        const connection = getVoiceConnection(interaction.guild.id)
        if (connection === undefined) {
            interaction.reply({ content: 'vcに接続していません', ephemeral: true })
            return
        }

        connection.disconnect()
        interaction.reply('vcから切断されました。音声認識を終了します。')

    }
}
