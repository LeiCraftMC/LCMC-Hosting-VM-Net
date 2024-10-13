import { ConfigHandler } from "../../configHandler.js";
import { Registrar } from "../../registrar.js";
import { CLICMD } from "../cmd.js";

export class NetUPCMD extends CLICMD {
    public name = "up";
    public description = "Enable VM-Network";
    public usage = "up";
    public async run(args: string[], parent_args: string[]) {
        console.log("Enabling VM-Network...");

        const config = ConfigHandler.loadConfig();
        ConfigHandler.copyConfigToTemp();
        await Registrar.register(config);

        console.log("VM-Network enabled!");
    }
}


export class NetDownCMD extends CLICMD {
    public name = "down";
    public description = "Disable VM-Network";
    public usage = "down";
    public async run(args: string[], parent_args: string[]) {
        console.log("Disabling VM-Network...");

        const config = ConfigHandler.loadLastUPConfig();
        await Registrar.unregister(config);

        console.log("VM-Network disabled!");
    }
}

export class NetReloadCMD extends CLICMD {
    public name = "reload";
    public description = "Reload VM-Network";
    public usage = "reload";
    public async run(args: string[], parent_args: string[]) {
        console.log("Reloading VM-Network...");

        const lastConfig = ConfigHandler.loadLastUPConfig();
        await Registrar.unregister(lastConfig);

        const config = ConfigHandler.loadConfig();
        ConfigHandler.copyConfigToTemp();
        await Registrar.register(config);

        console.log("VM-Network reloaded!");
    }
}
