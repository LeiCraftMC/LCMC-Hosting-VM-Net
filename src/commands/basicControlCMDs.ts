import { CLIBaseCommand } from "@cleverjs/cli";
import { VMNetConfig } from "../utils/vm-net-config.js";
import { Registrar } from "../registrar.js";
import { Logger } from "../utils/logger.js";


export class NetUPCMD extends CLIBaseCommand {

    constructor() {
        super({
            name: "up",
            description: "Enable VM-Network"
        })
    }

    override async run() {
        
        Logger.log("Enabling VM-Network...");

        const config = VMNetConfig.loadConfig();
        VMNetConfig.copyConfigToTemp();
        await Registrar.register(config);

        Logger.log("VM-Network enabled!");

        return true;
    }
}


export class NetDownCMD extends CLIBaseCommand {

    constructor() {
        super({
            name: "down",
            description: "Disable VM-Network"
        })
    }

    override async run() {
        Logger.log("Disabling VM-Network...");

        const config = VMNetConfig.loadLastUPConfig();
        await Registrar.unregister(config);

        Logger.log("VM-Network disabled!");

        return true;
    }
}

export class NetReloadCMD extends CLIBaseCommand {

    constructor() {
        super({
            name: "reload",
            description: "Reload VM-Network"
        })
    }

    override async run() {
        Logger.log("Reloading VM-Network...");

        const lastConfig = VMNetConfig.loadLastUPConfig();
        await Registrar.unregister(lastConfig);

        const config = VMNetConfig.loadConfig();
        VMNetConfig.copyConfigToTemp();
        await Registrar.register(config);

        Logger.log("VM-Network reloaded!");

        return true;
    }
}
