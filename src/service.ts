import { ConfigHandler } from "./configHandler";
import { Registrar } from "./registrar";

export class Service {
    static isRunning = false;


    static async start() {
        console.log("Enabling VM-Network...");

        const config = ConfigHandler.loadConfig();
        ConfigHandler.copyConfigToTemp();
        await Registrar.register(config);

        console.log("VM-Network enabled!");

    }

    static async stop() {
        console.log("Disabling VM-Network...");
                
        const config = ConfigHandler.loadLastUPConfig();
        await Registrar.unregister(config);
        
        console.log("VM-Network disabled!");
    }
}
