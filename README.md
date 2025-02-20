# Floatplane Plugin for Grayjay

[![Latest Release](https://gitlab.com/kaidelorenzo/grayjay-floatplane/-/badges/release.svg)](https://gitlab.com/kaidelorenzo/grayjay-floatplane/-/releases)

A [Grayjay](https://grayjay.app) plugin for [Floatplane](https://floatplane.com)

## Installation

[Open in Grayjay](grayjay://plugin/https://gitlab.com/kaidelorenzo/grayjay-floatplane/-/releases/permalink/latest/downloads/src/config.json)

[![Vimeo logo](deploy/icon.png)](grayjay://plugin/https://gitlab.com/kaidelorenzo/grayjay-floatplane/-/releases/permalink/latest/downloads/src/config.json)

Or scan the QR code from the Grayjay app

[![Scan this QR code in the Grayjay app to install this Vimeo plugin for Grayjay](assets/qr.svg)](grayjay://plugin/https://gitlab.com/kaidelorenzo/grayjay-floatplane/-/releases/permalink/latest/downloads/src/config.json)

## Missing Features

- [ ] none

## Development

0. Using [these swagger docs](https://jman012.github.io/FloatplaneAPIDocs/SwaggerUI-full/)
1. install typescript `tsc` and `node/npm`, `deno` or, `bun`
2. `npm update`
3. `tsc`
4. `npm run dev:node`

## TO-DO

- [ ] none

## How to create a private key for signing plugin scripts

`ssh-keygen -t rsa -b 2048 -m PEM -f private-key.pem`
