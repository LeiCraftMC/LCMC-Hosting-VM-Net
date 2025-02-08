import type { ConfigLike, NetSubnetConfigLike, NetRouteLike } from "./configHandler.js";
import { ShellCMD, IPTablesNatCMD, IP6TablesNatCMD, IPRouteCMD, IPRuleCMD, IPAddrCMD, IPTablesCMD } from "./linuxUtils.js";


export class ForwardingHandler {

    static async start(config: ConfigLike) {
        // mabye config to enable or disable forwarding

        await ShellCMD.run(`iptables -N LCMC-HOSTING-VM-NET_FW`);
        await ShellCMD.run(`iptables -t nat -N LCMC-HOSTING-VM-NET_PRO`);

        await this.runCMDs(true, config);
    }

    static async stop(config: ConfigLike) {
        // mabye config to enable or disable forwarding
        await this.runCMDs(false, config);

        await ShellCMD.run(`iptables -t nat -F LCMC-HOSTING-VM-NET_PRO`);
        await ShellCMD.run(`iptables -t nat -X LCMC-HOSTING-VM-NET_PRO`);
        await ShellCMD.run(`iptables -F LCMC-HOSTING-VM-NET_FW`);
        await ShellCMD.run(`iptables -X LCMC-HOSTING-VM-NET_FW`);
    }

    private static async runCMDs(enable: boolean, config: ConfigLike) {

        await IPTablesNatCMD.run(enable, `PREROUTING -m addrtype --dst-type LOCAL -j LCMC-HOSTING-VM-NET_PRO`);
        await IPTablesNatCMD.run(enable, `OUTPUT ! -d 127.0.0.0/8 -m addrtype --dst-type LOCAL -j LCMC-HOSTING-VM-NET_PRO`);

        const promises: Promise<void>[] = [];

        for (const [subnetID, subnetConfig] of Object.entries(config.subnets)) {
            promises.push(this.setupPerSubnet(enable, subnetID, subnetConfig));
        }

        await Promise.all(promises);
    }

    private static async setupPerSubnet(enable: boolean, subnetID: string, config: NetSubnetConfigLike) {

        await IPTablesCMD.run(enable, `FORWARD -o ${config.iface} -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT`);
        await IPTablesCMD.run(enable, `FORWARD -o ${config.iface} -j LCMC-HOSTING-VM-NET_FW`);
        await IPTablesCMD.run(enable, `FORWARD -i ${config.iface} ! -o ${config.iface} -j ACCEPT`);
        await IPTablesCMD.run(enable, `FORWARD -i ${config.iface} -o ${config.iface} -j ACCEPT`);

        await IPTablesNatCMD.run(enable, `LCMC-HOSTING-VM-NET_PRO -i ${config.iface} -j RETURN`);

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

                let pubPRWithHyphen: string;
                let pubPRWithColon: string;
                let localPRWithHyphen: string;
                let localPRWithColon: string;

                if (typeof portConfig === "string" || typeof portConfig === "number") {
                    pubPRWithHyphen = portConfig.toString();
                    pubPRWithColon = pubPRWithHyphen.replace("-", ":");
                    localPRWithHyphen = pubPRWithHyphen;
                    localPRWithColon = pubPRWithColon;
                } else {
                    pubPRWithHyphen = portConfig.pub.toString();
                    pubPRWithColon = pubPRWithHyphen.replace("-", ":");
                    localPRWithHyphen = portConfig.local.toString();
                    localPRWithColon = localPRWithHyphen.replace("-", ":");
                }

                await IPTablesCMD.run(enable, `LCMC-HOSTING-VM-NET_FW -d 192.168.${subnetID}.${serverID} ! -i ${subnetConfig.iface} -o ${subnetConfig.iface} -p tcp -m tcp --dport ${localPRWithColon} -j ACCEPT`);
                await IPTablesCMD.run(enable, `LCMC-HOSTING-VM-NET_FW -d 192.168.${subnetID}.${serverID} ! -i ${subnetConfig.iface} -o ${subnetConfig.iface} -p udp -m udp --dport ${localPRWithColon} -j ACCEPT`);

                await IPTablesNatCMD.run(enable, `POSTROUTING -s 192.168.${subnetID}.${serverID} -d 192.168.${subnetID}.${serverID} -p tcp -m tcp --dport ${localPRWithColon} -j MASQUERADE`)
                await IPTablesNatCMD.run(enable, `POSTROUTING -s 192.168.${subnetID}.${serverID} -d 192.168.${subnetID}.${serverID} -p udp -m udp --dport ${localPRWithColon} -j MASQUERADE`)

                await IPTablesNatCMD.run(enable, `LCMC-HOSTING-VM-NET_PRO -d ${subnetConfig.publicIP4} ! -i ${subnetConfig.iface} -p tcp -m tcp --dport ${pubPRWithColon} -j DNAT --to-destination 192.168.${subnetID}.${serverID}:${localPRWithHyphen}`);
                await IPTablesNatCMD.run(enable, `LCMC-HOSTING-VM-NET_PRO -d ${subnetConfig.publicIP4} ! -i ${subnetConfig.iface} -p udp -m udp --dport ${pubPRWithColon} -j DNAT --to-destination 192.168.${subnetID}.${serverID}:${localPRWithHyphen}`);

            }
        }
    }
}

