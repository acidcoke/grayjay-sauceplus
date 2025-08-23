# Sauce+ Plugin for Grayjay

A [Grayjay](https://grayjay.app) plugin for [Sauceplus](https://sauceplus.com)

## Installation


Click this [link](grayjay://plugin/https://github.com/acidcoke/grayjay-sauceplus/releases/latest/download/config.json)

Or scan the QR code from the Grayjay app

[![Scan this QR code in the Grayjay app to install this Sauceplus plugin for Grayjay](assets/qr.svg)](grayjay://plugin/https://github.com/acidcoke/grayjay-sauceplus/releases/latest/download/config.json)

## Missing Features

-   [ ] Downloading HLS streams. They are encrypted and download won't work until these changes are
    merged
    <https://gitlab.futo.org/videostreaming/grayjay/-/merge_requests/89>
-   [ ] Livestream support
-   [ ] Comments
-   [ ] Email login (Grayjay needs to be able to pass Cloudflare captcha). Discord login currently works
-   [ ] Playback tracking
-   [ ] Video recommendations
-   [ ] Channel page
-   [ ] Channel search
-   [ ] Non video content

## Development

0. Using [these swagger docs](https://jman012.github.io/SauceplusAPIDocs/SwaggerUI-full/)
1. install typescript (`tsc`) and `node/npm`, `deno` or, `bun`
2. `npm update`
3. `tsc`
4. `npm run dev:node`

## TODO

- [ ] Implement missing features

## How to create a private key for signing plugin scripts

`ssh-keygen -t rsa -b 2048 -m PEM -f private-key.pem`
