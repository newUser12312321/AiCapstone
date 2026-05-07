# React Kiosk Desktop Shortcut Setup (Raspberry Pi)

Use this when you want to close kiosk mode and relaunch it from the desktop icon.

## 0) Recommended: reserve static public IP on GCP VM

Use a static external IP so kiosk API target never changes.

1. GCP Console -> VPC network -> IP addresses
2. Reserve static address (regional, external)
3. Attach it to your Spring Boot VM NIC
4. Verify VM still serves `http://<STATIC_IP>:8080`

## 1) Install edge systemd service (replaces manual `python main.py`)

```bash
sudo cp /home/pi/AiCapstoneV2/edge/deploy/raspberry-pi/pcb-edge.service /etc/systemd/system/pcb-edge.service
sudo systemctl daemon-reload
sudo systemctl enable pcb-edge.service
```

## 2) Create one central environment file (single source of IP truth)

```bash
sudo cp /home/pi/AiCapstoneV2/frontend/deploy/raspberry-pi/aicapstone.env.example /etc/default/aicapstone
sudo nano /etc/default/aicapstone
```

Set:

```bash
API_HOST=<YOUR_GCP_STATIC_IP>
EDGE_HOST=127.0.0.1
```

## 3) Install kiosk web service template

```bash
sudo cp /home/pi/AiCapstoneV2/frontend/deploy/raspberry-pi/pcb-react-kiosk-web.service /etc/systemd/system/pcb-react-kiosk-web.service
```

## 4) Make start script executable

```bash
chmod +x /home/pi/AiCapstoneV2/frontend/deploy/raspberry-pi/react-kiosk-start
```

## 5) Install desktop shortcut

```bash
cp /home/pi/AiCapstoneV2/frontend/deploy/raspberry-pi/React-Kiosk.desktop /home/pi/Desktop/React-Kiosk.desktop
chmod +x /home/pi/Desktop/React-Kiosk.desktop
```

## 6) Allow one-click start/stop without password

Create sudoers rule:

```bash
echo 'pi ALL=(root) NOPASSWD: /usr/bin/systemctl start pcb-edge.service, /usr/bin/systemctl start pcb-react-kiosk-web.service, /usr/bin/systemctl start pcb-react-kiosk-browser.service, /usr/bin/systemctl stop pcb-react-kiosk-browser.service, /usr/bin/systemctl stop pcb-react-kiosk-web.service, /usr/bin/systemctl stop pcb-edge.service' | sudo tee /etc/sudoers.d/pcb-react-kiosk
sudo chmod 440 /etc/sudoers.d/pcb-react-kiosk
```

## 7) Restart services once

```bash
sudo systemctl daemon-reload
sudo systemctl restart pcb-edge.service
sudo systemctl restart pcb-react-kiosk-web.service
sudo systemctl restart pcb-react-kiosk-browser.service
```

## 8) Future IP change procedure (only one file edit)

If VM IP changes (or static IP reassigned), only update:

```bash
sudo nano /etc/default/aicapstone
sudo systemctl restart pcb-react-kiosk-web.service
sudo systemctl restart pcb-react-kiosk-browser.service
```
