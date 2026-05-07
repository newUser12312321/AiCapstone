# React Kiosk Desktop Shortcut Setup (Raspberry Pi)

Use this when you want to close kiosk mode and relaunch it from the desktop icon.

## 1) Install edge systemd service (replaces manual `python main.py`)

```bash
sudo cp /home/pi/AiCapstoneV2/edge/deploy/raspberry-pi/pcb-edge.service /etc/systemd/system/pcb-edge.service
sudo systemctl daemon-reload
sudo systemctl enable pcb-edge.service
```

## 2) Make start script executable

```bash
chmod +x /home/pi/AiCapstoneV2/frontend/deploy/raspberry-pi/react-kiosk-start
```

## 3) Install desktop shortcut

```bash
cp /home/pi/AiCapstoneV2/frontend/deploy/raspberry-pi/React-Kiosk.desktop /home/pi/Desktop/React-Kiosk.desktop
chmod +x /home/pi/Desktop/React-Kiosk.desktop
```

## 4) Allow one-click start/stop without password

Create sudoers rule:

```bash
echo 'pi ALL=(root) NOPASSWD: /usr/bin/systemctl start pcb-edge.service, /usr/bin/systemctl start pcb-react-kiosk-web.service, /usr/bin/systemctl start pcb-react-kiosk-browser.service, /usr/bin/systemctl stop pcb-react-kiosk-browser.service, /usr/bin/systemctl stop pcb-react-kiosk-web.service, /usr/bin/systemctl stop pcb-edge.service' | sudo tee /etc/sudoers.d/pcb-react-kiosk
sudo chmod 440 /etc/sudoers.d/pcb-react-kiosk
```

## 5) Restart services once

```bash
sudo systemctl restart pcb-edge.service
sudo systemctl restart pcb-react-kiosk-web.service
sudo systemctl restart pcb-react-kiosk-browser.service
```
