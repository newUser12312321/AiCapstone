# React Kiosk Desktop Shortcut Setup (Raspberry Pi)

Use this when you want to close kiosk mode and relaunch it from the desktop icon.

## 1) Make start script executable

```bash
chmod +x /home/pi/AiCapstoneV2/frontend/deploy/raspberry-pi/react-kiosk-start
```

## 2) Install desktop shortcut

```bash
cp /home/pi/AiCapstoneV2/frontend/deploy/raspberry-pi/React-Kiosk.desktop /home/pi/Desktop/React-Kiosk.desktop
chmod +x /home/pi/Desktop/React-Kiosk.desktop
```

## 3) Allow edge API to stop kiosk service without password

Create sudoers rule:

```bash
echo 'pi ALL=(root) NOPASSWD: /bin/systemctl stop pcb-react-kiosk-browser.service' | sudo tee /etc/sudoers.d/pcb-react-kiosk
sudo chmod 440 /etc/sudoers.d/pcb-react-kiosk
```

If your systemctl path is `/usr/bin/systemctl`, replace `/bin/systemctl` accordingly.

## 4) Restart edge service

Restart your edge API process/service so the new endpoint logic is applied.
