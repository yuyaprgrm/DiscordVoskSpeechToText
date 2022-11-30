import { CacheType, CommandInteraction, GuildMember, RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder } from "discord.js";
import { joinVoiceChannel, AudioReceiveStream, EndBehaviorType, getVoiceConnection } from '@discordjs/voice';
import { OpusEncoder } from '@discordjs/opus';
import { GrammarRecognizerParam, Recognizer, SpeakerRecognizerParam } from 'vosk';
import { SampleRate, VoskModel } from "./vosk-core"; 
import { spawn } from 'child_process';
import fs from 'node:fs';

export abstract class BaseCommand {
    public static commandJson: RESTPostAPIApplicationCommandsJSONBody;
    public abstract execute(interaction: CommandInteraction): void;
}

const BufferSize = 4000

export class JoinCommand extends BaseCommand{
    public static commandJson: RESTPostAPIApplicationCommandsJSONBody =
        new SlashCommandBuilder()
            .setName('join')
            .setDescription('start translating speech to text.')
            .toJSON()

    public execute(interaction: CommandInteraction<CacheType>): void {
        if (interaction.guild === null || !(interaction.member instanceof GuildMember)) {
            interaction.reply('command is only available in guild')
            return
        }

        const guild = interaction.guild
        const member = interaction.member
        if (member.voice.channel === null) {
            interaction.reply({ content: 'vcに接続していません', ephemeral: true })
            return
        }

        if (interaction.channel === null) {
            interaction.reply({ content: '不明なエラーです...', ephemeral: true})
            return
        }

        const vchannel = member.voice.channel
        const tchannel = interaction.channel;

        if (!vchannel.joinable) {
            interaction.reply({ content: 'vcに接続できません', ephemeral: true })
            return
        }

        const connection = joinVoiceChannel({
            channelId: vchannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false
        })

        const speakingLock = new Map<string, 0>
        const speakerRecognizers = new Map<string, Recognizer<GrammarRecognizerParam>>
        
        connection.receiver.speaking.on("start", async userId => {
            const user = await guild.client.users.fetch(userId);

            if (speakingLock.has(userId) || user.bot) {
                return;
            }
            speakingLock.set(userId, 0)
            let recognizer: Recognizer<GrammarRecognizerParam>;
            if (!speakerRecognizers.has(userId)) {
                recognizer = new Recognizer({ model: VoskModel, sampleRate: SampleRate, grammar: [] })
                speakerRecognizers.set(userId, recognizer)
            } else {
                recognizer = speakerRecognizers.get(userId)!
            }
            const name = String(Date.now());
            const path = name + ".raw";
            const fileStream = fs.createWriteStream(path)

            tchannel.sendTyping()

            const audioStream = connection.receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 500
                }
            })

            const encoder = new OpusEncoder(48000, 2)
            
            audioStream.on("data", chunk => {
                fileStream.write(encoder.decode(chunk))
            })

            audioStream.on("end", async () => {
                const ffmpeg_run = spawn('ffmpeg', ['-loglevel', 'quiet', '-ar', '48000', '-ac', '2', '-f', 's16le', '-i', path,
                    '-ar', String(SampleRate), '-ac', '1',
                    '-f', 's16le', '-bufsize', String(BufferSize), '-']);

                ffmpeg_run.stdout.on('data', (stdout) => {
                    recognizer.acceptWaveform(stdout)
                    // if (recognizer.acceptWaveform(stdout))
                    //     console.log(recognizer.result());
                    // else
                    //     console.log(recognizer.partialResult());
                    // console.log(recognizer.finalResult());
                });

                ffmpeg_run.stdout.on("end", () => {
                    const result = recognizer.finalResult();
                    if (result.text !== '')
                        tchannel.send(user.username + ": " + result.text.split(' ').join(''))
                    
                    recognizer.reset()
                    fs.rmSync(path)
                })

                speakingLock.delete(userId)
            })
        })

        interaction.reply('vcに接続完了しました。音声認識を開始します。')
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
        interaction.reply('vcから切断されました。録音を終了します。')

    }
}