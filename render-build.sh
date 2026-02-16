#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
npm run build

# Store/pull Chrome cache
STORAGE_DIR=/opt/render/project/.render

if [[ ! -d $STORAGE_DIR/chrome ]]; then
  echo "...Downloading Chrome"
  mkdir -p $STORAGE_DIR/chrome
  cd $STORAGE_DIR/chrome
  wget -P ./ https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  dpkg -x ./google-chrome-stable_current_amd64.deb $STORAGE_DIR/chrome
  rm ./google-chrome-stable_current_amd64.deb
  cd $HOME/project/src # Make sure we return to the right directory
else
  echo "...Using Chrome from cache"
fi

# Add Chrome to path (optional, but good for reference)
export PATH="${PATH}:/opt/render/project/.render/chrome/opt/google/chrome"
