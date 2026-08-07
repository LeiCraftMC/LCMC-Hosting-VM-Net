import { CLISubCMD } from "./cmd.js";
import { NetDownCMD, NetReloadCMD, NetUPCMD, VersionCMD } from "./commands/basicCMDs.js";

export class CLICMDHandler extends CLISubCMD {
    public name = "root";
    public description = "CLI Root";
    public usage = "Command has no usage";

    private static instance: CLICMDHandler;

    public static getInstance() {
        if (!this.instance) {
            this.instance = new CLICMDHandler();
        }
        return this.instance;
    }

    protected registerCommands() {
        this.register(new VersionCMD());

        this.register(new NetUPCMD());
        this.register(new NetDownCMD());
        this.register(new NetReloadCMD());

        //this.register(new ConfigCMD());
    }

    protected async run_empty(parent_args: string[]) {
        //cli.cmd.info(`Command not recognized. Type "${CLIUtils.parsePArgs(parent_args, true)}help" for available commands.`);
        return;
    }

    public async handle(input: string) {
        this.run(input.trim().toLowerCase().split(" ").filter(arg => arg), []);
    }

}
