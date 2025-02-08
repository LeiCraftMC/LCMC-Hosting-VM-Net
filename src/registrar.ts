import type { ConfigLike, NetSubnetConfigLike, NetRouteLike } from "./configHandler.js";
import { ShellCMD, IPTablesNatCMD, IP6TablesNatCMD, IPRouteCMD, IPRuleCMD, IPAddrCMD } from "./linuxUtils.js";


export class ForwardingHandler {

    static async start(config: ConfigLike) {
        // mabye config to enable or disable forwarding
        await this.runCMDs(true, config);
    }

    static async stop(config: ConfigLike) {
        // mabye config to enable or disable forwarding
        await this.runCMDs(false, config);
    }

    private static async runCMDs(enable: boolean, config: ConfigLike) {
        const promises: Promise<void>[] = [];

        for (const [subnetID, subnetConfig] of Object.entries(config.subnets)) {
            promises.push(this.setupPerSubnet(enable, subnetID, subnetConfig));
        }

        await Promise.all(promises);
    }

    private static async setupPerSubnet(enable: boolean, subnetID: string, config: NetSubnetConfigLike) {
        const promises: Promise<void>[] = [];

        for (const [serverID, serverConfig] of Object.entries(config.servers)) {
            promises.push(this.setupPerServer(enable, serverID, serverConfig, subnetID, config));
        }

        await Promise.all(promises);
    }

    private static async setupPerServer(enable: boolean, serverID: string, config: NetRouteLike, subnetID: string, subnetConfig: Omit<NetSubnetConfigLike, "routes">) {
        await Promise.all([
            this.setupServerIPv4Forwarding(enable, serverID, config, subnetID),
            this.setupServerIPv6Forwarding(enable, serverID, config, subnetID, subnetConfig),
            this.setupServerPortForwarding(enable, serverID, config, subnetID, subnetConfig)
        ]);
    }

    private static async setupServerIPv4Forwarding(enable: boolean, serverID: string, config: NetRouteLike, subnetID: string) {
        if (config.ipv4) {
            await IPTablesNatCMD.run(enable, `POSTROUTING -s 192.168.${subnetID}.${serverID} -o ${config.ipv4.targetIface} -j MASQUERADE`);
            await IPRouteCMD.run(enable, subnetID, serverID, config.ipv4.targetIface);
            await IPRuleCMD.run(enable, subnetID, serverID);

            await IPTablesNatCMD.run(enable, `PREROUTING -p tcp -d ${config.ipv4.addr} -i ${config.ipv4.targetIface} -j DNAT --to-destination 192.168.${subnetID}.${serverID}`);
            await IPTablesNatCMD.run(enable, `PREROUTING -p udp -d ${config.ipv4.addr} -i ${config.ipv4.targetIface} -j DNAT --to-destination 192.168.${subnetID}.${serverID}`);
        }
    }

    private static async setupServerIPv6Forwarding(enable: boolean, serverID: string, config: NetRouteLike, subnetID: string, subnetConfig: Omit<NetSubnetConfigLike, "routes">) {
        if (config.ipv6) {
            await IPAddrCMD.run(enable, subnetConfig.publicIP6Prefix, subnetID, serverID, subnetConfig.targetIface);
            await IP6TablesNatCMD.run(enable, `PREROUTING -p tcp -d ${subnetConfig.publicIP6Prefix}:${subnetID}::${serverID} -i ${subnetConfig.targetIface} -j DNAT --to-destination fd00:${subnetID}::${serverID}`);
            await IP6TablesNatCMD.run(enable, `PREROUTING -p udp -d ${subnetConfig.publicIP6Prefix}:${subnetID}::${serverID} -i ${subnetConfig.targetIface} -j DNAT --to-destination fd00:${subnetID}::${serverID}`);
            
            if (config.extraIPv6 && config.extraIPv6.length > 0) {
                for (const ending of config.extraIPv6) {
                    if (/^[0-9a-f]$/.test(ending)) {
                        const fullServerID = serverID + ending;
                        await IPAddrCMD.run(enable, subnetConfig.publicIP6Prefix, subnetID, fullServerID, subnetConfig.targetIface);
                        await IP6TablesNatCMD.run(enable, `PREROUTING -p tcp -d ${subnetConfig.publicIP6Prefix}:${subnetID}::${fullServerID} -i ${subnetConfig.targetIface} -j DNAT --to-destination fd00:${subnetID}::${fullServerID}`);
                        await IP6TablesNatCMD.run(enable, `PREROUTING -p udp -d ${subnetConfig.publicIP6Prefix}:${subnetID}::${fullServerID} -i ${subnetConfig.targetIface} -j DNAT --to-destination fd00:${subnetID}::${fullServerID}`);
                    }
                }
            }
        }
    }

    private static async setupServerPortForwarding(enable: boolean, serverID: string, config: NetRouteLike, subnetID: string, subnetConfig: Omit<NetSubnetConfigLike, "routes">) {
        if (config.ports) {
            for (const portConfig of config.ports) {
                if (typeof portConfig === "string" || typeof portConfig === "number") {
                    const pubPortRange = portConfig.toString().replace("-", ":");
                    await IPTablesNatCMD.run(enable, `PREROUTING -p tcp -d ${subnetConfig.publicIP4} --dport ${pubPortRange} -i ${subnetConfig.targetIface} -j DNAT --to-destination 192.168.${subnetID}.${serverID}:${portConfig}`);
                    await IPTablesNatCMD.run(enable, `PREROUTING -p udp -d ${subnetConfig.publicIP4} --dport ${pubPortRange} -i ${subnetConfig.targetIface} -j DNAT --to-destination 192.168.${subnetID}.${serverID}:${portConfig}`);
                } else {
                    const pubPortRange = portConfig.pub.toString().replace("-", ":");
                    await IPTablesNatCMD.run(enable, `PREROUTING -p tcp -d ${subnetConfig.publicIP4} --dport ${pubPortRange} -i ${subnetConfig.targetIface} -j DNAT --to-destination 192.168.${subnetID}.${serverID}:${portConfig.local}`);
                    await IPTablesNatCMD.run(enable, `PREROUTING -p udp -d ${subnetConfig.publicIP4} --dport ${pubPortRange} -i ${subnetConfig.targetIface} -j DNAT --to-destination 192.168.${subnetID}.${serverID}:${portConfig.local}`);
                }
            }
        }
    }
}

