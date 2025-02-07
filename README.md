# vm-net

# Install
Execute as root
```bash
bash <(curl -s https://raw.githubusercontent.com/LeiCraftMC/LCMC-Hosting-VM-Net/refs/heads/master/scripts/bash/install.sh)
```
`/etc/systemd/system/lcmc-hosting-vm-net.service`
```
[Unit]
Description=LCMC-Hosting-VM-Net
After=network.target

[Service]
User=root
ExecStart=/usr/local/bin/lcmc-hosting-vm-net
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

# Uninstall
Execute as root
```bash
bash <(curl -s https://raw.githubusercontent.com/LeiCraftMC/LCMC-Hosting-VM-Net/refs/heads/master/scripts/bash/uninstall.sh)
```

# Running from Sources

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

