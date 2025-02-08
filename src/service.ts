import { ConfigHandler, type NetSubnetConfigLike } from "./configHandler";
import { IP6TablesNatCMD, IPTablesNatCMD, ShellCMD } from "./linuxUtils";
import { ProxyHandler } from "./proxy";
import { ForwardingHandler } from "./registrar";

export class Service {
    static isRunning = false;

    static useProxy: boolean;
    static useForwarding: boolean;

    static async start(useProxy = false, useForwarding = false) {
        if (this.isRunning) {
            console.log("VM-Network is already running!");
            return;
        }
        this.isRunning = true;

        this.useProxy = useProxy;
        this.useForwarding = useForwarding;

        const config = ConfigHandler.loadConfig();
        ConfigHandler.copyConfigToTemp();
        if (!config.enabled) {
            console.log("VM-Network is disabled in the config file!");
            return;
        }

        await this.enableIPForwarding();
        await this.setupBasicPreRouting(true);
        await this.setupSubnetInternetAccess(true, config.subnets);

        if (this.useForwarding) {
            console.log("Enabling VM-Network...");
            await ForwardingHandler.start(config);
            console.log("VM-Network enabled!");
        }

        if (this.useProxy) {
            console.log("Enabling Proxy...");
            await ProxyHandler.start(config);
            console.log("Proxy enabled!");
        }
    }

    static async stop() {
        if (!this.isRunning) {
            console.log("VM-Network is already disabled!");
            return;
        }
        this.isRunning = false;

        

        const config = ConfigHandler.loadLastUPConfig();
        if (!config.enabled) {
            console.log("VM-Network is disabled in the config file!");
            return;
        }

        await this.setupBasicPreRouting(false);
        await this.setupSubnetInternetAccess(false, config.subnets);

        if (this.useForwarding) {
            console.log("Disabling VM-Network...");
            await ForwardingHandler.stop(config);
            console.log("VM-Network disabled!");
        }

        if (this.useProxy) {
            console.log("Disabling Proxy...");
            await ProxyHandler.stop(config);
            console.log("Proxy disabled!");
        }
    }

    private static async enableIPForwarding() {
        await Promise.all([
            ShellCMD.run("echo 1 > /proc/sys/net/ipv4/ip_forward"),
            ShellCMD.run("echo 1 > /proc/sys/net/ipv4/conf/all/proxy_arp"),
    
            ShellCMD.run("echo 1 > /proc/sys/net/ipv6/conf/all/forwarding"),
            ShellCMD.run("echo 1 > /proc/sys/net/ipv6/conf/all/proxy_ndp")
        ]);
    }
    
    
    private static async setupBasicPreRouting(enable: boolean) {
        await ShellCMD.run(`iptables -t raw -${enable ? "I" : "D"} PREROUTING -i fwbr+ -j CT --zone 1`);
        await ShellCMD.run(`ip6tables -t raw -${enable ? "I" : "D"} PREROUTING -i fwbr+ -j CT --zone 1`);
    }

    private static async setupSubnetInternetAccess(enable: boolean, subnets: {[subnet: string]: NetSubnetConfigLike}) {
        
        const promises: Promise<void>[] = [];

        for (const [subnetID, subnetConfig] of Object.entries(subnets)) {
            promises.push(
                IPTablesNatCMD.run(enable, `POSTROUTING -s '192.168.${subnetID}.0/24' -o ${subnetConfig.targetIface} -j MASQUERADE`),
                IP6TablesNatCMD.run(enable, `POSTROUTING -s 'fd00:${subnetID}::/64' -o ${subnetConfig.targetIface} -j MASQUERADE`)
            );
        }

        await Promise.all(promises);
    }
}
