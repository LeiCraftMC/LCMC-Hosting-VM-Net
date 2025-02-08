import { CLISubCMD } from "@cleverjs/cli";

export class ConfigCMD extends CLISubCMD {
    public name = "config";
    public description = "Manage configuration";
    public usage = "config <command> [args]";

    protected registerCommands() {
        
    }
}
