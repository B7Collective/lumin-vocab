#!/bin/sh
# Rebuilds every app icon from the SVG sources. Needs rsvg-convert (librsvg).
# Run from the repository root: sh tools/icons/make.sh
set -e
out=public/icons
rsvg-convert -w 192 -h 192 "$out/logo.svg" -o "$out/app-192.png"
rsvg-convert -w 512 -h 512 "$out/logo.svg" -o "$out/app-512.png"
rsvg-convert -w 512 -h 512 tools/icons/maskable.svg -o "$out/app-maskable-512.png"
rsvg-convert -w 192 -h 192 tools/icons/maskable.svg -o "$out/app-maskable-192.png"
rsvg-convert -w 180 -h 180 tools/icons/square.svg -o "$out/app-apple-180.png"
cp "$out/app-apple-180.png" public/apple-touch-icon.png  # iPhones also look here when a page has no icon link
rsvg-convert -w 32 -h 32 "$out/favicon.svg" -o "$out/favicon-32.png"
echo "Icons written to $out"
