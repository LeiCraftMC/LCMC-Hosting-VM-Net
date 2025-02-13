#!/bin/bash

BIN_PATH="/usr/local/bin/lcmc-hosting-vm-net"

function install {
    local VERSION=$1

    # Determine the system architecture
    local ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        ARCH="linux-x64"
    elif [ "$ARCH" = "aarch64" ]; then
        ARCH="linux-arm64"
    else
        echo "Unsupported architecture: $ARCH"
        exit 1
    fi

    local VERSION_TAG="v$VERSION"
    if [ "$VERSION" == "latest" ] || [ -z "$VERSION" ]; then
        # Fetch the latest release or pre-release version from GitHub API
        VERSION_TAG=$(curl -s https://api.github.com/repos/LeiCraftMC/LCMC-Hosting-VM-Net/releases | grep -E '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | head -n 1)
    fi

    URL="https://github.com/LeiCraftMC/LCMC-Hosting-VM-Net/releases/download/${VERSION_TAG}/vm-net-${VERSION_TAG}-${ARCH}"

    # Download the appropriate binary
    echo "Downloading LCMC-Hosting-VM-Net version $VERSION_TAG for architecture $ARCH..."
    http_response_code="$(curl --write-out '%{http_code}' -sL -o "$BIN_PATH" "$URL")"

    if [ "$http_response_code" != "200" ]; then
        echo "Failed to download LeiCoin-Node binary. HTTP response code: $http_response_code"
            exit 1
    fi

    chmod u+x "$BIN_PATH"

    echo "LCMC-Hosting-VM-Net $VERSION_TAG download completed successfully."

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

    install $1

    echo "LCMC-Hosting-VM-Net has been installed successfully."
}

main