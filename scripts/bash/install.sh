#!/bin/bash

BIN_PATH="/usr/local/bin/lcmc-hosting-vm-net"

function install {
    # Determine the system architecture
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        ARCH="linux-x64"
    elif [ "$ARCH" = "aarch64" ]; then
        ARCH="linux-arm64"
    else
        echo "Unsupported architecture: $ARCH"
        exit 1
    fi

    # Fetch the latest release or pre-release version from GitHub API
    LATEST_RELEASE=$(curl -s https://api.github.com/repos/LeiCraftMC/LCMC-Hosting-VM-Net/releases | grep -E '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | head -n 1)

    URL="https://github.com/LeiCraftMC/LCMC-Hosting-VM-Net/releases/download/${LATEST_RELEASE}/vm-net-${LATEST_RELEASE}-${ARCH}"

    # Download the appropriate binary
    echo "Downloading LCMC-Hosting-VM-Net version $LATEST_RELEASE for architecture $ARCH..."
    curl -L -o "$BIN_PATH" "$URL"

    if [ $? -eq 0 ]; then
        echo "Download completed successfully."
        chmod u+x "$BIN_PATH"
    else
        echo "Download failed. Please check your connection or the URL."
        exit 1
    fi
}

function main {

    if [ -f "$BIN_PATH" ]; then
        echo "LCMC-Hosting-VM-Net is already installed."
        read -p "Do you want to reinstall or upgrade LCMC-Hosting-VM-Net? (y/n): " reinstall_choice
        if [ "$reinstall_choice" != "y" ]; then
            echo "Installation aborted."
            exit 1
        fi
    fi

    install

    echo "LCMC-Hosting-VM-Net has been installed successfully."
}

main