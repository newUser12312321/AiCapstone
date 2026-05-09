# .NET/C# 전면 재구성 가이드

## 목적

- Edge(라즈베리파이)는 실시간 촬영/추론/표시를 담당
- Cloud는 상세 검사 내역 저장/조회/운영 관리를 담당
- Cloud 스택을 C#(.NET)으로 통일

## 구성 요소

- `backend-dotnet/src/AiFactory.Api`
  - ASP.NET Core Web API
  - EF Core(SQLite 기본, 추후 Cloud SQL/PostgreSQL 교체 가능)
  - MQTT 수신 워커 (`MqttIngestService`)
  - OPC UA 확장 워커 (`OpcUaTelemetryService`)
- `frontend-csharp/PcbDashboard`
  - Blazor WebAssembly
  - `/api/inspections` 조회 기반 상세 내역 화면

## Edge 연동 규격

Edge는 아래 REST 엔드포인트로 전송:

- `POST /api/inspections`

필드명은 기존 Python `InspectionPacket.to_server_json()`과 동일한 camelCase를 사용한다.

## 실행 절차

1. API 실행
   - `cd backend-dotnet/src/AiFactory.Api`
   - `dotnet restore && dotnet run`
2. Dashboard 실행
   - `cd frontend-csharp/PcbDashboard`
   - `dotnet restore && dotnet run`
3. Edge 환경변수 수정
   - `SERVER_BASE_URL=http://<api-host>:5000`
4. Edge 더미 전송 확인
   - `POST /edge/inspect/dummy`
5. Dashboard에서 데이터 조회 확인

## GCP 배포 메모

- API: Cloud Run
- Dashboard: Firebase Hosting 또는 Cloud Run(정적 서빙)
- DB: 크레딧 사용 기간 Cloud SQL 권장
- MQTT 브로커: EMQX Cloud 또는 VM 직접 구성
