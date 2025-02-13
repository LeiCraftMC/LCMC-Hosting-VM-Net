#!/bin/bash

BIN_PATH="/usr/local/bin/lcmc-hosting-vm-net"
CONFIG_PATH="/etc/lcmc-hosting/vm-net"
CACHE_PATH="/var/tmp/lcmc-hosting/vm-net"

function delete_bin {
    rm -f "$BIN_PATH"
}

function delete_configs {
    if [[ ! -d "$CONFIG_PATH" && ! -d "$CACHE_PATH" ]]; then return; fi

    if [[ -d "$CONFIG_PATH" ]]; then
        rm -rf "$CONFIG_PATH"
    fi
    if [[ -d "$CACHE_PATH" ]]; then
        rm -rf "$CACHE_PATH"
    fi
    echo "Configuration and cache files deleted."
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
    if [[ "${@#--with-configs}" = "$@" ]]; then
        delete_configs
    fi

    echo "LCMC-Hosting-VM-Net has been uninstalled successfully."
}

main $@
