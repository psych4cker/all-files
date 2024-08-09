#!/usr/bin/bash
greet() {
  read -r -p "What's your name: " name
  echo "WELCOME "$name "welcome!!" 
  exit
}

while true; do
    read -p "Do you want greet? " yn
    case $yn in
      [Yy]* ) greet;;
      [Nn]* ) exit;;
    esac
  done