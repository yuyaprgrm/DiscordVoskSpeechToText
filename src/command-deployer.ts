import { REST, Routes } from 'discord.js'
import dotenv from 'dotenv' 
import { ByeCommand, JoinCommand } from './commands';

dotenv.config()
const token = process.env.TOKEN!
const clientId = process.env.CLIENT_ID!

const commands = [
    JoinCommand,
    ByeCommand
]
// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commands.map(command => command.commandJson) },
		);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})()