#!/bin/bash

BIN_PATH="/usr/local/bin/lcmc-hosting-vm-net"
CONFIG_PATH="/etc/lcmc-hosting/vm-net"
CACHE_PATH="/var/tmp/lcmc-hosting/vm-net"

function delete_bin {
    rm -f "$BIN_PATH"
}

function delete_configs {

    if [[ ! -d "$CONFIG_PATH" && ! -d "$CACHE_PATH" ]]; then return; fi

    read -p "Do you want to also delete configuration and cache files? (y/n): " delete_config_choice
    if [[ "$delete_config_choice" == "y" || "$delete_config_choice" == "Y" ]]; then
        if [[ -d "$CONFIG_PATH" ]]; then
            rm -rf "$CONFIG_PATH"
        fi
        if [[ -d "$CACHE_PATH" ]]; then
            rm -rf "$CACHE_PATH"
        fi
        echo "Configuration and cache files deleted."
    else
        echo "Configuration and cache files retained."
    fi
}

function main {

    if [[ ! -f "$BIN_PATH" ]]; then
        echo "LCMC-Hosting-VM-Net is not installed."
        exit 1
    fi

    #read -p "Are you sure you want to uninstall LCMC-Hosting-VM-Net? (y/n): " confirm
    #if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    #    echo "Uninstallation aborted."
    #    exit 1
    #fi

    delete_bin
    delete_configs

    echo "LCMC-Hosting-VM-Net has been uninstalled successfully."
}

main $@
