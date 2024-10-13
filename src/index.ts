import { ConfigHandler } from "./configHandler.js";
import { Registrar } from "./registrar.js";
import "./utils.js";
import Utils from "./utils.js";

export default class Main {

    static async init() {

        const args = process.argv.slice(2);

        if (args.length !== 1) {
            console.error("Invalid number of arguments. Must be 'up' or 'down'");
            Utils.gracefulShutdown(1); return;
        }

        if (args[0] === "up") {
            
            const config = ConfigHandler.loadConfig();
            ConfigHandler.copyConfigToTemp();
            await Registrar.register(config);

        } else if (args[0] === "down") {

            const config = ConfigHandler.loadLastUPConfig();
            await Registrar.unregister(config);

        } else {
            console.error("Invalid argument. Must be 'up' or 'down'");
            Utils.gracefulShutdown(1); return;
        }

    }

}

Main.init();