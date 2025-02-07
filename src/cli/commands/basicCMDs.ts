import { ConfigHandler } from "../../configHandler.js";
import { Registrar } from "../../registrar.js";
import { Service } from "../../service.js";
import { CLICMD } from "../cmd.js";

export class VersionCMD extends CLICMD {
    public name = "-v";
    public description = "Print version";
    public usage = "-v";

    async run() {
        console.log(`LeiCraft_MC Hosting VM-Net ${process.env.APP_VERSION}`);
    }
}

export class NetUPCMD extends CLICMD {
    public name = "up";
    public description = "Enable VM-Network";
    public usage = "up";
    public async run() {
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

    async run() {
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

    async run() {
        console.log("Reloading VM-Network...");

        const lastConfig = ConfigHandler.loadLastUPConfig();
        await Registrar.unregister(lastConfig);

        const config = ConfigHandler.loadConfig();
        ConfigHandler.copyConfigToTemp();
        await Registrar.register(config);

        console.log("VM-Network reloaded!");
    }
}

export class RunCMD extends CLICMD {
    public name = "reload";
    public description = "Run VM-Network And Proxy";
    public usage = "reload";

    async run() {
        Service.start();
    }
}

