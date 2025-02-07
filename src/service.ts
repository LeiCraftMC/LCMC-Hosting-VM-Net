import { ConfigHandler } from "./configHandler";
import { ProxyHandler } from "./proxy";
import { Registrar } from "./registrar";

export class Service {
    static isRunning = false;

    static async start() {
        this.isRunning = true;

        console.log("Enabling VM-Network...");

        const config = ConfigHandler.loadConfig();
        ConfigHandler.copyConfigToTemp();
        await Registrar.register(config);

        console.log("VM-Network enabled!");

        ProxyHandler.start(config);

    }

    static async stop() {
        console.log("Disabling VM-Network...");
                
        const config = ConfigHandler.loadLastUPConfig();
        await Registrar.unregister(config);
        
        console.log("VM-Network disabled!");

        await ProxyHandler.stop(config);
    }
}
