# Voice STT — 디바이스 사이드 음성 변환

## 무엇

Stage 2 음성 기록(PRD-001 AC-001-02)의 음성 → 텍스트 변환을 **디바이스
사이드**에서 수행한다. 서버는 텍스트만 받는다 — 오디오 원본은 별도
업로드 흐름(audio-storage.md)을 따른다.

## 모델 선택

- 엔진: `whisper.rn` (whisper.cpp의 RN 바인딩)
- 모델: `ggml-small` (multilingual, ~466MB)
- 언어: 한국어 강제 (`language: 'ko'`)

### 왜 small?

| 모델 | 크기 | 한국어 짧은 문장 정확도 | 전화기 디코딩 시간(15s 입력) |
|------|------|----------------------|--------------------------|
| tiny | ~75MB | 매우 낮음 (지명/감성 표현 자주 누락) | ~2s |
| base | ~150MB | 낮음 | ~4s |
| **small** | **~466MB** | **사용 가능** | **~8s** |
| medium | ~1.5GB | 좋음 | ~25s, 메모리 부담 큼 |

`tiny`/`base`는 임산부의 짧고 감성적인 발화에서 너무 자주 깨졌다.
`medium`은 일부 보급형 안드로이드에서 OOM. `small`이 정확도-자원의
타협점이다.

> 측정값은 도입 결정용 예시다. 실제 출시 전 iOS/Android 실기 1대씩
> 측정해 docs 갱신 필요 — 임계치 미달 시 작업 일정 조정.

## 모델 호스팅

`MODEL_URL = https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin`

- **앱 번들에 포함하지 않는다.** 466MB는 store install 한도에 부담이고,
  사용자 중 음성 기록을 안 쓰는 사람에게도 다운로드를 강제한다.
- **첫 음성 기록 진입 시 다운로드.** `record-audio-review` 화면에서
  STT 시작 직전 `ensureModel()`이 진행률 콜백과 함께 받아온다.
- **무결성**: `MODEL_SHA256`을 비교 (옵션). 빈 문자열이면 검사 생략 —
  dev에서 모델 revision을 바꿔가며 실험할 때 켰다 껐다 한다.
- **재시도/취소**: `createDownloadResumable`이 pause/resume 가능. 사용자가
  취소하면 progress가 유지돼 다음 진입 시 이어받을 수 있다.

## 실패 폴백

| 실패 모드 | 처리 |
|-----------|------|
| 모델 다운로드 실패 (네트워크) | 사용자에게 표시 + 재시도 버튼. 텍스트 입력 fallback. |
| 무결성 체크 실패 | 파일 삭제 후 재다운로드. 두 번 실패하면 오류 alert. |
| `whisper.rn` native 모듈 누락 (예: 웹) | engine은 throw, review 화면은 빈 transcript로 폴백 → 사용자 직접 입력. |
| STT timeout (60초 cap) | 부분 결과 없이 throw. 사용자 직접 입력. |
| STT 결과가 빈 문자열 | review 화면에서 빈 placeholder. 저장 버튼은 disabled. |

핵심 원칙: **STT가 실패해도 사용자는 텍스트로 저장할 수 있어야 한다.**
오디오 파일은 저장 흐름에서 별도로 처리되므로(보관함 옵션 포함), STT
실패가 기록 자체를 막지 않는다.

## E2E fixture

`EXPO_PUBLIC_E2E_AUDIO_FIXTURE=1` 일 때 다음 3가지만 단축된다:
- `record-audio` 화면은 마이크 권한 요청을 건너뛰고 [다음] 버튼 노출.
  대신 cache 디렉터리에 dummy m4a 바이트를 실제로 써둔다.
- `whisperEngine.transcribe()`는 캔드 한국어 transcript 반환
  (mic 입력이 없으니 STT를 돌릴 게 없음).
- `modelManager.ensureModel()`은 다운로드 없이 더미 경로 반환.

**업로드 오케스트레이터(`uploadAudio`)와 백엔드는 fixture 분기가
없다.** 즉 e2e에서 [저장 후 음성 원본 업로드] 또는 보관함의 [업로드]를
누르면 실제로 backend의 presign → MinIO PUT → backend PATCH가 모두
일어난다. 이렇게 두면 시뮬레이터 한계로 어쩔 수 없이 가짜인 mic·STT를
제외한 모든 path가 e2e에서 검증된다.

CI 환경 변수:
- `EXPO_PUBLIC_E2E_AUDIO_FIXTURE=1` (앱 빌드 시 inline)
- 백엔드: `AWS_S3_ENDPOINT=http://127.0.0.1:9000` (iOS) /
  `http://localhost:9000` (Android, `adb reverse tcp:9000 tcp:9000` 와 함께)
- `AWS_S3_USE_PATH_STYLE=true`
- `AWS_ACCESS_KEY_ID=minioadmin`, `AWS_SECRET_ACCESS_KEY=minioadmin`

## 한계와 향후 작업

- **STT 정확도**: small 모델의 한국어 정확도는 사용자 편집 단계에서
  최종 보정한다. 서버 Whisper(large) 폴백은 후속 PRD.
- **부분 transcript 표시**: `whisper.rn`이 partial 토큰을 안정적으로
  내보내지 않아 현재는 "변환 중…" 텍스트만 표시. 라이브러리 개선 시
  실시간 transcript로 전환.
- **모델 호스팅 마이그레이션**: HuggingFace 직링크는 가용성/속도/지역
  차단에 종속. 트래픽이 늘면 자체 CloudFront로 옮긴다 (URL/SHA만 갱신).
