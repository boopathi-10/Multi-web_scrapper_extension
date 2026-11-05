#!/usr/bin/env python3
"""
ScrapeFlow - Extension Packaging Script
Validates manifest, checks asset references, and packages the extension into a store-ready ZIP archive.
"""

import os
import json
import zipfile
import sys

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(base_dir, "dist")
    manifest_path = os.path.join(base_dir, "manifest.json")

    print("[1/4] Validating manifest.json...")
    if not os.path.isfile(manifest_path):
        print("ERROR: manifest.json not found!")
        sys.exit(1)

    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception as e:
        print(f"ERROR: Invalid JSON in manifest.json: {e}")
        sys.exit(1)

    # Check required fields
    required_keys = ["manifest_version", "name", "version", "icons", "action"]
    for key in required_keys:
        if key not in manifest:
            print(f"ERROR: Missing required field '{key}' in manifest.json")
            sys.exit(1)

    if manifest.get("manifest_version") != 3:
        print("ERROR: manifest_version must be 3 for Chrome Web Store submissions!")
        sys.exit(1)

    version = manifest.get("version", "1.0.0")
    print(f"  ✓ Manifest V3 validated: '{manifest['name']}' v{version}")

    # Check icons
    print("[2/4] Checking required icons...")
    for sz, icon_rel in manifest["icons"].items():
        icon_path = os.path.join(base_dir, icon_rel)
        if not os.path.isfile(icon_path):
            print(f"ERROR: Icon {sz}x{sz} defined at '{icon_rel}' does not exist!")
            sys.exit(1)
        print(f"  ✓ Icon {sz}x{sz}: {icon_rel} exists")

    # Files to include in production extension ZIP
    include_patterns = [
        "manifest.json",
        "background/service-worker.js",
        "content/content.js",
        "content/content.css",
        "popup/popup.html",
        "popup/popup.css",
        "popup/popup.js",
        "icons/icon16.png",
        "icons/icon32.png",
        "icons/icon48.png",
        "icons/icon128.png"
    ]

    print("[3/4] Verifying extension source files...")
    for rel_path in include_patterns:
        full_path = os.path.join(base_dir, rel_path)
        if not os.path.isfile(full_path):
            print(f"ERROR: Missing required file: {rel_path}")
            sys.exit(1)
        print(f"  ✓ Found {rel_path}")

    # Create ZIP package
    os.makedirs(dist_dir, exist_ok=True)
    zip_filename = f"scrapeflow-v{version}.zip"
    zip_path = os.path.join(dist_dir, zip_filename)

    print(f"[4/4] Creating store-ready package '{zip_filename}'...")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for rel_path in include_patterns:
            full_path = os.path.join(base_dir, rel_path)
            zipf.write(full_path, arcname=rel_path)

    file_size_kb = os.path.getsize(zip_path) / 1024
    print("\n========================================================")
    print(" BUILD SUCCESSFUL!")
    print(f" Package created: {zip_path}")
    print(f" Archive size:   {file_size_kb:.2f} KB")
    print(" Ready for Chrome Web Store Developer Dashboard upload!")
    print("========================================================\n")

if __name__ == "__main__":
    main()
