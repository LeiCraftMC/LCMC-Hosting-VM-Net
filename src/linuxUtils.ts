export class ShellCMD {
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

export class IPTablesCMD {
    protected static baseCMD = "iptables";

    static async run(enable: boolean, cmd: string) {
        const fullCMD = `${this.baseCMD} -${enable ? "A" : "D"} ${cmd}`;
        await ShellCMD.run(fullCMD);
    }

    static async runInsert(enable: boolean, cmd: string) {
        const fullCMD = `${this.baseCMD} -${enable ? "I" : "D"} ${cmd}`;
        await ShellCMD.run(fullCMD);
    }
}

export class IP6TablesCMD extends IPTablesCMD {
    protected static baseCMD = "ip6tables";
}

export class IPTablesNatCMD extends IPTablesCMD {
    protected static baseCMD = "iptables -t nat";
}

export class IP6TablesNatCMD extends IP6TablesCMD {
    protected static baseCMD = "ip6tables -t nat";
}


export class IPAddrCMD {

    protected static baseCMD = "ip addr";

    static async run(enable: boolean, ipPrefix: string, subnet: string, server: string, iface: string) {
        const fullCMD = `${this.baseCMD} ${enable ? "add" : "del"} ${ipPrefix}:${subnet}::${server} dev ${iface}`;
        await ShellCMD.run(fullCMD);
    }

}

export class IPRuleCMD {

    protected static baseCMD = "ip rule ";

    static async run(enable: boolean, subnet: string, server: string) {
        const fullCMD = `${this.baseCMD} ${enable ? "add" : "del"} from 192.168.${subnet}.${server} lookup 8006${subnet}${server}`;
        await ShellCMD.run(fullCMD);
    }

}

export class IPRouteCMD {

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


