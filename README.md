# 라즈베리파이 기반 PCB 비전 검사 시스템

라즈베리파이에 연결된 현장 터치 키오스크 를 통해 **PCB 이미지를 검사**하고, **Spring Boot + MySQL**에 이력을 저장한 뒤 **React**로 대시보드를 통해 확인합니다

## 바로 따라하기

처음 클론해서 동작만 확인하려면 아래 문서만 순서대로 읽으면 됩니다.

**[docs/getting-started.md](docs/getting-started.md)** — 설치부터 Docker/로컬 실행, 라즈베리파이 엣지, 키오스크까지 한 번에 정리했습니다.

## 구성 요약

| 경로 | 역할 |
|------|------|
| `edge/` | Python, FastAPI, YOLO, 카메라·GPIO |
| `backend/` | Java 17, Spring Boot 3, REST API |
| `frontend/` | React 18, Vite — 운영 대시보드 + **키오스크**(`/kiosk` 등) |
| `frontend-kiosk/` | Blazor WASM 예제(참고용). **현장 키오스크는 사용하지 않음.** |

## 저장소

```bash
git clone https://github.com/newUser12312321/AiCapstone.git
cd AiCapstone
```

폴더 이름은 원하는 대로 바꿔도 됩니다. 문서 안의 `C:\Projects\...` 는 예시 경로입니다.
