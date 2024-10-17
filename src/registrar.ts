import type { ConfigLike, NetSubnetConfigLike, NetRouteLike, NetRoutePortConfigLike } from "./configHandler.js";

class ShellCMD {
    static async run(cmd: string) {
        try {
            await Bun.$`${{ raw: cmd }}`.quiet();
            console.log(`Executed: ${cmd}`);
        } catch {
            console.error(`Failed to execute: ${cmd}`);
        }
    }
    static async get(cmd: string) {
        try {
            return (await Bun.$`${{ raw: cmd }}`.text()).trim();
        } catch {
            return null;
        }
    }
}

class IPTablesCMD {
    protected static baseCMD = "iptables -t nat";

    static async run(enable: boolean, cmd: string) {
        const fullCMD = `${this.baseCMD} -${enable ? "A" : "D"} ${cmd}`;
        await ShellCMD.run(fullCMD);
    }

    static async runInsert(enable: boolean, cmd: string) {
        const fullCMD = `${this.baseCMD} -${enable ? "I" : "D"} ${cmd}`;
        await ShellCMD.run(fullCMD);
    }
}

class IP6TablesCMD extends IPTablesCMD {
    protected static baseCMD = "ip6tables -t nat";
}


class IPAddrCMD {

    protected static baseCMD = "ip addr";

    static async run(enable: boolean, ipPrefix: string, subnet: string, server: string, iface: string) {
        const fullCMD = `${this.baseCMD} ${enable ? "add" : "del"} ${ipPrefix}:${subnet}::${server} dev ${iface}`;
        await ShellCMD.run(fullCMD);
    }

}

class IPRuleCMD {

    protected static baseCMD = "ip rule ";

    static async run(enable: boolean, subnet: string, server: string) {
        const fullCMD = `${this.baseCMD} ${enable ? "add" : "del"} from 192.168.${subnet}.${server} lookup 8006${subnet}${server}`;
        await ShellCMD.run(fullCMD);
    }

}

class IPRouteCMD {

    protected static baseCMD = "ip route ";

    static async run(enable: boolean, subnet: string, server: string, iface: string) {
        const gateway = await ShellCMD.get(`ip route show dev ${iface} | awk '/default/ {print $3}'`)
        if (!gateway) {
            console.error(`Failed to get gateway for ${iface}`);
            return;
        }
        const fullCMD = `${this.baseCMD} ${enable ? "add" : "del"} default via ${gateway} dev ${iface} table 8006${subnet}${server}`;
        await ShellCMD.run(fullCMD);
    }

}



export class Registrar {

    static async register(config: ConfigLike) {
        if (config.enabled) {
            await Promise.all([
                this.enableIPForwarding(),
                this.runCMDs(true, config)
            ]);
        }
    }

    static async unregister(config: ConfigLike) {
        if (config.enabled) {
            await this.runCMDs(false, config);
        }
    }

    private static async runCMDs(enable: boolean, config: ConfigLike) {
        const promises: Promise<void>[] = [];

        promises.push(this.setupBasicPreRouting(enable));

        for (const [subnetID, subnetConfig] of Object.entries(config.subnets)) {
            promises.push(this.setupPerSubnet(enable, subnetID, subnetConfig));
        }

        await Promise.all(promises);
    }


    private static async enableIPForwarding() {
        await Promise.all([
            ShellCMD.run("echo 1 > /proc/sys/net/ipv4/ip_forward"),
            ShellCMD.run("echo 1 > /proc/sys/net/ipv4/conf/all/proxy_arp"),

            ShellCMD.run("echo 1 > /proc/sys/net/ipv6/conf/all/forwarding"),
            ShellCMD.run("echo 1 > /proc/sys/net/ipv6/conf/all/proxy_ndp")
        ])
    }


    private static async setupBasicPreRouting(enable: boolean) {
        await ShellCMD.run(`iptables -t raw -${enable ? "I" : "D"} PREROUTING -i fwbr+ -j CT --zone 1`);
        await ShellCMD.run(`ip6tables -t raw -${enable ? "I" : "D"} PREROUTING -i fwbr+ -j CT --zone 1`);
    }

    private static async setupPerSubnet(enable: boolean, subnetID: string, config: NetSubnetConfigLike) {

        await IPTablesCMD.run(enable, `POSTROUTING -s '192.168.${subnetID}.0/24' -o ${config.targetIface} -j MASQUERADE`);
        await IP6TablesCMD.run(enable, `POSTROUTING -s 'fd00:${subnetID}::/64' -o ${config.targetIface} -j MASQUERADE`);

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
            await IPTablesCMD.run(enable, `POSTROUTING -s 192.168.${subnetID}.${serverID} -o ${config.ipv4.targetIface} -j MASQUERADE`);
            await IPRouteCMD.run(enable, subnetID, serverID, config.ipv4.targetIface);
            await IPRuleCMD.run(enable, subnetID, serverID);

            await IPTablesCMD.run(enable, `PREROUTING -p tcp -d ${config.ipv4.addr} -i ${config.ipv4.targetIface} -j DNAT --to-destination 192.168.${subnetID}.${serverID}`);
            await IPTablesCMD.run(enable, `PREROUTING -p udp -d ${config.ipv4.addr} -i ${config.ipv4.targetIface} -j DNAT --to-destination 192.168.${subnetID}.${serverID}`);
        }
    }

    private static async setupServerIPv6Forwarding(enable: boolean, serverID: string, config: NetRouteLike, subnetID: string, subnetConfig: Omit<NetSubnetConfigLike, "routes">) {
        if (config.ipv6) {
            await IPAddrCMD.run(enable, subnetConfig.publicIP6Prefix, subnetID, serverID, subnetConfig.targetIface);
            await IP6TablesCMD.run(enable, `PREROUTING -p tcp -d ${subnetConfig.publicIP6Prefix}:${subnetID}::${serverID} -i ${subnetConfig.targetIface} -j DNAT --to-destination fd00:${subnetID}::${serverID}`);
            await IP6TablesCMD.run(enable, `PREROUTING -p udp -d ${subnetConfig.publicIP6Prefix}:${subnetID}::${serverID} -i ${subnetConfig.targetIface} -j DNAT --to-destination fd00:${subnetID}::${serverID}`);
            
            if (config.extraIPv6 && config.extraIPv6.length > 0) {
                for (const ending of config.extraIPv6) {
                    if (/^[0-9a-f]$/.test(ending)) {
                        const fullServerID = serverID + ending;
                        await IPAddrCMD.run(enable, subnetConfig.publicIP6Prefix, subnetID, fullServerID, subnetConfig.targetIface);
                        await IP6TablesCMD.run(enable, `PREROUTING -p tcp -d ${subnetConfig.publicIP6Prefix}:${subnetID}::${fullServerID} -i ${subnetConfig.targetIface} -j DNAT --to-destination fd00:${subnetID}::${fullServerID}`);
                        await IP6TablesCMD.run(enable, `PREROUTING -p udp -d ${subnetConfig.publicIP6Prefix}:${subnetID}::${fullServerID} -i ${subnetConfig.targetIface} -j DNAT --to-destination fd00:${subnetID}::${fullServerID}`);
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
                    await IPTablesCMD.run(enable, `PREROUTING -p tcp -d ${subnetConfig.publicIP4} --dport ${pubPortRange} -i ${subnetConfig.targetIface} -j DNAT --to-destination 192.168.${subnetID}.${serverID}:${portConfig}`);
                    await IPTablesCMD.run(enable, `PREROUTING -p udp -d ${subnetConfig.publicIP4} --dport ${pubPortRange} -i ${subnetConfig.targetIface} -j DNAT --to-destination 192.168.${subnetID}.${serverID}:${portConfig}`);
                } else {
                    const pubPortRange = portConfig.pub.toString().replace("-", ":");
                    await IPTablesCMD.run(enable, `PREROUTING -p tcp -d ${subnetConfig.publicIP4} --dport ${pubPortRange} -i ${subnetConfig.targetIface} -j DNAT --to-destination 192.168.${subnetID}.${serverID}:${portConfig.local}`);
                    await IPTablesCMD.run(enable, `PREROUTING -p udp -d ${subnetConfig.publicIP4} --dport ${pubPortRange} -i ${subnetConfig.targetIface} -j DNAT --to-destination 192.168.${subnetID}.${serverID}:${portConfig.local}`);
                }
            }
        }
    }
}

