import { Message, Client, GatewayIntentBits, Events, BaseInteraction } from 'discord.js'
import dotenv from 'dotenv'
import { ByeCommand, JoinCommand } from './commands'

dotenv.config()

const client = new Client({
    intents: [GatewayIntentBits.Guilds | GatewayIntentBits.GuildVoiceStates],
})

client.once(Events.ClientReady, () => {
    console.log('Ready!')
    console.log(client.user!.tag)
})

client.on(Events.InteractionCreate, async (interaction: BaseInteraction) => {
    if (!interaction.isChatInputCommand()) return;
    switch (interaction.commandName) {
        case 'join':
            new JoinCommand().execute(interaction)
            break
        case 'bye':
            new ByeCommand().execute(interaction)
            break
    }
})

client.login(process.env.TOKEN!)