#!/bin/sh
set -e

echo "Installing Node dependencies"
npm install

echo "Installing CocoaPods"
cd ios
pod install
