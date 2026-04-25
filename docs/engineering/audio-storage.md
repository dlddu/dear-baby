# Audio Storage — Stage 2 음성 원본 저장

## 무엇

Stage 2 음성 기록(PRD-001)에서 발생하는 **원본 m4a 오디오**를 AWS S3에
저장한다. 변환된 텍스트(transcript)는 `records.content`에 항상 저장되고,
오디오 원본은 사용자가 명시적으로 업로드를 선택할 때만 같은 row의
`records.audio_s3_key` 컬럼에 키가 채워진다.

## 핵심 인바리언트

- **`records.audio_s3_key`는 영구히 NULL일 수 있다.**
  - 텍스트 입력 record (`source='text'`): 항상 NULL.
  - 음성 입력 record (`source='voice'`): 사용자가 [저장 후 음성 원본
    업로드]를 선택했고 PUT/PATCH가 모두 성공했을 때만 set, 그 외에는
    NULL. 사용자는 보관함에서 [삭제]를 골라 영원히 NULL로 둘 수 있다.
- **클라이언트가 키를 조립하지 않는다.** 백엔드가
  `s3.BuildRecordAudioKey(userID, recordID)`로 생성해 upload-url 응답에
  포함시키고, 이후 PATCH 시 같은 키가 다시 들어왔는지(소유자/record
  일치) 검증한다.
- **PATCH는 NULL → set 일회성 전이만 허용.** 한 record의
  `audio_s3_key`가 이미 non-null이면 두 번째 PATCH는 409. 동일 사용자가
  여러 기기에서 같은 record를 동시에 업로드하는 경합 시 늦은 쪽이
  로컬 사본을 정리한다.

## 환경 변수

| 키 | 필수 | 예시 | 비고 |
|---|------|------|------|
| `AWS_REGION` | 필수 | `ap-northeast-2` | bucket과 동일 region |
| `AWS_ASSUME_ROLE_ARN` | 선택 | `arn:aws:iam::123456789012:role/dear-baby-records-writer` | 비우면 default credential chain (로컬/IRSA용). MinIO에서는 무시됨 |
| `AWS_S3_BUCKET` | 필수 | `dear-baby-records-prod` | 환경별로 다른 bucket |
| `AWS_S3_KEY_PREFIX` | 선택 | `prod`, `staging`, `dev/alice` | 끝 슬래시는 백엔드에서 정규화. 빈값 = bucket 루트 |
| `AWS_S3_ENDPOINT` | 선택 | `http://minio:9000` | S3 호환 서비스(MinIO/LocalStack)용 endpoint 오버라이드. AWS 운영에서는 비움 |
| `AWS_S3_USE_PATH_STYLE` | 선택 | `true` | path-style URL 강제 (`endpoint/bucket/key`). MinIO에서 필수, AWS는 둘 다 가능 |

`AWS_S3_BUCKET` 또는 `AWS_REGION`이 비어 있으면 `Config.AudioUploadsEnabled()`가
false가 되고 라우터가 audio 엔드포인트를 503으로 응답한다 (라우트 자체는
mount되어 있어 미설정 사실이 클라이언트 로그에 분명하게 드러난다).

k8s `aws-assume-role-secret`은 **필수**다 (deployment의 `envFrom`에서
`optional` 마커 없음). S3를 사용하지 않는 환경(로컬/CI)에서는 빈 값으로
secret을 생성한다 — 그러면 위 가드에 걸려 audio 라우트만 503이 되고 그
외 기능은 정상 동작한다. 누락 시 pod가 시작하지 못하므로 운영 사고를
silent failure가 아닌 rollout failure로 surface 시킬 수 있다.

## 로컬 개발 (MinIO)

`docker-compose up`은 minio 서비스를 띄우고 `dear-baby-records-dev`
bucket을 자동 생성한다. backend는 위 5개 env로 minio를 가리키도록
이미 wired되어 있어, 별도 AWS 계정 없이 audio 엔드포인트를 실제로 호출해볼 수 있다.

콘솔 (object 확인용): `http://localhost:9001` (id/pw `minioadmin`).

## 통합 테스트

`backend/internal/storage/integration_test.go`는 실제 S3 호환 서비스에
대해 presign → PUT → HEAD 라운드트립을 검증한다.

- 로컬: `docker-compose up minio minio-bootstrap` 후
  ```
  MINIO_ENDPOINT=http://127.0.0.1:9000 \
  MINIO_ACCESS_KEY=minioadmin \
  MINIO_SECRET_KEY=minioadmin \
  MINIO_BUCKET=dear-baby-records-dev \
    go test -v -run TestIntegration ./internal/storage/...
  ```
- CI: `.github/workflows/integration.yml`이 minio 컨테이너를 띄우고
  bucket을 만든 뒤 위 명령을 실행한다.
- env가 미설정이면 `t.Skip()` — 일반 `go test ./...`은 영향 없음.

## 키 컨벤션

```
{prefix}/users/{userID}/records/{recordID}.m4a
```

- prefix가 빈 문자열이면 leading slash 없이 `users/...` 부터 시작.
- prefix는 `NormalizePrefix()`로 trailing slash가 잘려 들어가므로
  `prod` / `prod/` / `prod//` 모두 동일한 키를 만든다.
- `userID`/`recordID`는 백엔드가 발급한 UUID. 클라이언트가 임의 prefix를
  실어 PATCH해도 백엔드의 `BuildRecordAudioKey` 결과와 string 비교하므로
  cross-tenant 키 위변조를 차단한다.

## AssumeRole 구성

`AWS_ASSUME_ROLE_ARN`이 설정되면 backend는 부팅 시 default credential
chain (env / IRSA / instance profile / ~/.aws)로 STS client를 만들고,
거기서 `stscreds.AssumeRoleProvider`를 통해 지정 role의 단기 credential을
받는다. `aws.NewCredentialsCache()`로 감싸므로 SDK가 만료 직전에 자동
갱신한다.

빈 ARN의 경우 default credential chain을 그대로 사용한다 — 로컬 개발에서
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` 환경 변수를 사용할 때, 또는
EKS의 IRSA로 pod에 직접 role을 attach할 때 이 경로를 탄다.

## 엔드포인트

모두 인증 필요(`auth.RequireAuth`).

### `POST /records`

기존 엔드포인트. 신규 필드 `source`(`text`|`voice`, 기본 `text`)를 받는다.
voice인 경우에도 row 생성은 즉시 가능하며 `audio_s3_key`는 NULL로 시작.

### `POST /records/{id}/audio/upload-url`

소유자 검증 → rate limit (사용자당 분당 10회) → presigned PUT URL 발급
(TTL 5분). 응답:

```json
{
  "upload_url": "https://...",
  "audio_s3_key": "prod/users/.../records/....m4a",
  "expires_at": "2026-04-25T12:34:56Z"
}
```

이미 attached된 record에 재요청 시 409. URL 만료 시 클라이언트가 같은
endpoint를 다시 호출해 새 URL을 받는다 (멱등).

### `PATCH /records/{id}`

`{audio_s3_key}` 필드를 받아 set한다. 다음을 검증:
1. 소유자 일치 (record가 user의 것)
2. 받은 key가 백엔드의 `BuildRecordAudioKey(uid, id)` 결과와 정확히 일치
3. S3에 해당 객체가 존재 (HEAD)
4. `audio_s3_key`가 현재 NULL (NULL → set 전이만 허용; 이미 attached면 409)

성공 시 업데이트된 record JSON 반환.

## 운영 메모

- **rate limit**: in-memory(`sync.Map` + sliding window). 단일 pod 가정.
  scale-out 시 Redis 기반으로 교체. (현재 deployment는 replicas=1)
- **부팅 검증**: 부팅 로그에 bucket 이름과 prefix를 출력 (role ARN은
  존재 여부만). 잘못된 secret이 주입돼도 감지가 즉시 된다.
- **테스트 mocking**: `internal/storage` 패키지의 단위 테스트는
  `BuildRecordAudioKey`/`NormalizePrefix`만 검증한다. 통합 테스트에서
  실제 S3를 띄우려면 minio/localstack 도입 필요 — 현재 범위 밖.

## 알려진 한계

- **single-pod rate limit**: 위 운영 메모 참조.
- **재생 UI 없음**: 본 작업 범위는 업로드까지. 향후 재생 추가 시 GET
  presigned URL 발급용 별도 엔드포인트가 필요.
- **수명 관리 없음**: S3 lifecycle policy는 별도 인프라 작업으로 적용한다.
  무한 보관이 기본 동작.
