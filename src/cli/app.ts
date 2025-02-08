import { CLIApp } from "@cleverjs/cli";
import { /* NetDownCMD, NetReloadCMD, NetUPCMD, */ RunCMD, VersionCMD } from "./commands/basicCMDs.js";

export class CLICMDHandler extends CLIApp {

    private static instance: CLICMDHandler;

    public static getInstance() {
        if (!this.instance) {
            this.instance = new CLICMDHandler("shell");
        }
        return this.instance;
    }

    protected registerCommands() {
        this.register(new VersionCMD());

        /*
        this.register(new NetUPCMD());
        this.register(new NetDownCMD());
        this.register(new NetReloadCMD());
        */

        this.register(new RunCMD());

        //this.register(new ConfigCMD());
    }

}
