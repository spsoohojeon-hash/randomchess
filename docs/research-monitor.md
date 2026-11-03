# PC 밖에서 매시간 연구실 상태 점검

별도 Cloudflare Worker가 매시간 7분에 D1 기록을 확인합니다. PC나 브라우저가 꺼져도 실행됩니다. 기존 게임 Worker와 별도 배포하므로 게임 재배포가 점검 스케줄을 지우지 않습니다. 공개 HTTP 접속과 상태 조회는 제공하지 않습니다.

## 점검 내용

- 수집이 켜진 상태에서 PC heartbeat가 10분 이상 없으면 접속 끊김.
- 앞선 점검부터 1시간 이상 새 대국 행동이 보고되지 않으면 진행 정체. 긴 탐색 또는 업로드 지연일 수도 있어 확인을 요청합니다. 대국 완료 판수만으로 정체를 판단하지 않습니다.
- 이전 점검보다 대국 오류 수가 증가하면 새 오류 알림.
- 학습 실패 또는 학습 중 진행 보고가 2시간 이상 멈추면 학습 경고.
- 의도적으로 수집을 일시정지하면 PC 끊김/대국 정체 경고를 내지 않습니다.

같은 문제는 반복 전송하지 않고 문제 변경·해제 때 알립니다. 전송 실패는 다음 점검에서 재시도합니다. 네트워크에서 전송은 성공했으나 응답/DB 저장이 실패하면 중복 알림이 발생할 수 있습니다. 주기 점검이므로 즉시 알림은 아니며 최악에는 다음 시간 점검까지 기다립니다. Cloudflare 자체 장애나 모니터 Cron 자체 중단은 이 모니터만으로 알림을 보장하지 못합니다. 화면에 마지막 점검 시각과 90분 이상 지난 기록 경고를 표시합니다.

## 배포

수집기 데이터나 설정 파일을 삭제하지 않습니다. 프로젝트 폴더에서 새 PowerShell로 실행합니다.

```powershell
git pull --ff-only
pnpm.cmd research:setup
pnpm.cmd exec wrangler deploy --config wrangler.monitor.jsonc
```

`wrangler.monitor.jsonc`의 D1 `database_id`가 기존 게임 `wrangler.jsonc`와 같은지 확인해야 합니다. 기존 연구실 초기 설정이 완료된 DB를 사용하세요. 연구실 비밀번호는 기존 값 유지를 선택합니다. Cron 전파에 시간이 걸릴 수 있어 배포 직후 첫 점검 기록은 없을 수 있습니다.

사이트 연구실에 로그인하면 **매시간 상태 점검** 영역에서 마지막 점검 시각·경고·외부 알림 연결 상태가 보입니다. 알림 수신처를 연결하지 않아도 점검 기록은 남지만 휴대폰 푸시가 발송되지는 않습니다.

## 외부 알림 연결 — 하나만 선택

채널은 본인만 볼 수 있게 설정하세요. 메시지에는 실행 상태만 포함하며 비밀번호·능력·기보·학습 데이터는 넣지 않습니다. 비밀값을 채팅이나 GitHub에 올리지 말고 아래 명령의 비밀값 입력 단계에서 직접 붙여넣습니다.

### Discord 비공개 채널

본인 전용 서버/비공개 채널에서 만든 Discord 웹훅 URL을 등록합니다.

```powershell
pnpm.cmd exec wrangler secret put DISCORD_WEBHOOK_URL --config wrangler.monitor.jsonc
```

URL 형식은 `https://discord.com/api/webhooks/숫자/토큰`입니다. 다른 호스트와 임의의 외부 주소는 허용하지 않습니다. Discord 앱에서 해당 채널 알림을 켜야 휴대폰 알림을 받습니다.

### Telegram 개인 봇

본인 봇과 대화를 먼저 시작하고 봇 토큰 및 본인 채팅 ID를 등록합니다.

```powershell
pnpm.cmd exec wrangler secret put TELEGRAM_BOT_TOKEN --config wrangler.monitor.jsonc
pnpm.cmd exec wrangler secret put TELEGRAM_CHAT_ID --config wrangler.monitor.jsonc
```

두 채널 모두 등록되어 있으면 Telegram을 우선합니다. 실제 전송은 다음 점검에서 새 문제 또는 기존 경고 해제가 감지될 때 일어납니다. 연결 상태 표시는 비밀값 설정 여부이며 휴대폰 수신을 보장하는 표시가 아닙니다. 첫 실제 알림 수신을 확인하세요.

## 끄기

`wrangler.monitor.jsonc`에서 `triggers.crons`를 `[]`로 바꾸고 모니터를 다시 배포합니다. 기존 대국 수집·학습 및 데이터는 유지됩니다.

## 검증

상태 판정, 일시정지 구분, 중복 억제·실패 재시도·복구 알림, 수신처 미설정, 임의 URL 차단을 로컬 테스트로 검증했습니다. 실제 Cloudflare Cron 배포 및 Discord/Telegram 휴대폰 수신은 사용자 환경에서 확인해야 합니다.

Cloudflare Cron 공식 문서: https://developers.cloudflare.com/workers/configuration/cron-triggers/
