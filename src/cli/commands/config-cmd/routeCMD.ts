import { CLICMD, CLISubCMD } from "@cleverjs/cli";
import { ConfigHandler } from "../../../configHandler.js";

export class RoutesConfigCMD extends CLISubCMD {
    public name = "route";
    public description = "Manage routes";
    public usage = "route <command> [args]";

    protected registerCommands() {
        this.register(new RouteAddCMD());
        this.register(new RouteDelCMD());
    }

}

class RouteConifgUtils {

    static parseFullVMID(fullVMID: string) {
        if (!fullVMID.match(/^[0-9]+$/)) {
            return null;
        }

        if (fullVMID.length < 4 || fullVMID.length > 6) {
            return null;
        }

        const vmid = fullVMID.slice(-3);
        const subnet = fullVMID.slice(0, -3);
        return [subnet, vmid];
    }

}

class RouteAddCMD extends CLICMD {
    public name = "add";
    public description = "Add route";
    public usage = "add <vmid>";

    public async run(args: string[]) {
        if (args.length !== 1) {
            console.log("Invalid number of arguments!"); return;
        }

        const parsedVMID = RouteConifgUtils.parseFullVMID(args[0]);
        if (!parsedVMID) {
            console.log("Invalid VMID!"); return;
        }
        const [subnet, vmid] = parsedVMID;

        const config = ConfigHandler.loadConfig();
        
        if (config.subnets) {
            console.log("Route already exists!"); return;
        }
    }

}

class RouteDelCMD extends CLICMD {
    public name = "del";
    public description = "Delete route";
    public usage = "del <subnet> <vmid>";

    public async run(args: string[]) {

    }

}
