# React 키오스크 — 데스크톱 바로가기·systemd (라즈베리파이)

Chromium으로 React 키오스크 전체 화면을 띄운 뒤, 닫았을 때 바탕화면 아이콘으로 다시 실행하고 싶을 때의 절차입니다.

**Blazor 키오스크**(`frontend-kiosk`)를 쓰는 경우에는 [docs/12_라즈베리파이_키오스크_자동실행.md](../../../docs/12_라즈베리파이_키오스크_자동실행.md)를 우선 참고하세요. 아래는 `frontend/deploy/raspberry-pi`에 있는 **React 전용** 유닛입니다.

아래 예시에서 `REPO_HOME`은 저장소 클론 경로입니다(예: `/home/pi/inspection`, `/home/pi/AiCapstone`).

## 0) 백엔드 API 주소 고정

키오스크가 바라볼 Spring Boot 주소가 바뀌지 않게 합니다.

- **집/사무실 LAN**: PC에 고정 IP(DHCP 예약) 부여
- **클라우드 VM**: 탄력 IP 대신 **고정 공인 IP** 또는 안정적인 DNS 이름 사용

브라우저나 `curl`로 `http://<API_HOST>:8080` 이 응답하는지 확인합니다.

## 1) 엣지 systemd 서비스 설치

```bash
sudo cp "$REPO_HOME/edge/deploy/raspberry-pi/pcb-edge.service" /etc/systemd/system/pcb-edge.service
sudo systemctl daemon-reload
sudo systemctl enable pcb-edge.service
```

## 2) 환경 파일 한 곳에 모으기

```bash
sudo cp "$REPO_HOME/frontend/deploy/raspberry-pi/aicapstone.env.example" /etc/default/aicapstone
sudo nano /etc/default/aicapstone
```

예:

```bash
API_HOST=<백엔드_호스트_IP_또는_DNS>
EDGE_HOST=127.0.0.1
```

## 3) React 키오스크 웹 서비스 템플릿 설치

```bash
sudo cp "$REPO_HOME/frontend/deploy/raspberry-pi/pcb-react-kiosk-web.service" /etc/systemd/system/pcb-react-kiosk-web.service
```

## 4) 시작 스크립트 실행 권한

```bash
chmod +x "$REPO_HOME/frontend/deploy/raspberry-pi/react-kiosk-start"
```

## 5) 데스크톱 바로가기 복사

```bash
cp "$REPO_HOME/frontend/deploy/raspberry-pi/React-Kiosk.desktop" /home/pi/Desktop/React-Kiosk.desktop
cp "$REPO_HOME/frontend/deploy/raspberry-pi/React-Kiosk-UI-Only.desktop" /home/pi/Desktop/React-Kiosk-UI-Only.desktop
chmod +x /home/pi/Desktop/React-Kiosk.desktop
chmod +x /home/pi/Desktop/React-Kiosk-UI-Only.desktop
```

(UI-only 스크립트를 쓸 경우)

```bash
chmod +x "$REPO_HOME/frontend/deploy/raspberry-pi/react-kiosk-start-ui-only"
```

## 6) 원클릭 시작·중지(sudo 비밀번호 생략)

```bash
echo 'pi ALL=(root) NOPASSWD: /usr/bin/systemctl start pcb-edge.service, /usr/bin/systemctl start pcb-react-kiosk-web.service, /usr/bin/systemctl start pcb-react-kiosk-browser.service, /usr/bin/systemctl stop pcb-react-kiosk-browser.service, /usr/bin/systemctl stop pcb-react-kiosk-web.service, /usr/bin/systemctl stop pcb-edge.service' | sudo tee /etc/sudoers.d/pcb-react-kiosk
sudo chmod 440 /etc/sudoers.d/pcb-react-kiosk
```

## 7) 서비스 재시작

```bash
sudo systemctl daemon-reload
sudo systemctl restart pcb-edge.service
sudo systemctl restart pcb-react-kiosk-web.service
sudo systemctl restart pcb-react-kiosk-browser.service
```

## 8) API 주소가 바뀔 때

`/etc/default/aicapstone`만 수정한 뒤 키오스크 관련 서비스를 재시작합니다.

```bash
sudo nano /etc/default/aicapstone
sudo systemctl restart pcb-react-kiosk-web.service
sudo systemctl restart pcb-react-kiosk-browser.service
```
