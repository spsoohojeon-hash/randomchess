# Windows 개인 컴퓨터에서 자동대국·학습 실행

컴퓨터에서 어려움 AI 두 편이 대국합니다. 각 편은 자기 능력과 공개 정보만 관측하고 상대 미공개 능력은 추정합니다. 완료된 대국으로 신경망을 학습하며 검증을 통과한 모델이 이후 판단을 보조합니다. 관리자 화면은 양쪽 정보를 볼 수 있지만 그 정보가 AI 입력으로 전달되지는 않습니다. 학습 오차 감소가 실력 상승을 보장하지는 않습니다.

PC는 계산·원본 SQLite·모델 저장을 담당하고 기존 Cloudflare Worker/D1은 비밀번호로 보호된 폰 화면과 기록 동기화를 담당합니다. 공유기 포트 개방은 필요 없습니다. 유료 VPS는 필요 없지만 Cloudflare 사용 한도와 PC 전기·저장 공간은 소비합니다. 네트워크나 업로드가 실패하면 수집기가 대기합니다.

## 1. 최초 설치

- Node.js **24.x Windows x64 .msi**: https://nodejs.org/download/release/latest-v24.x/
- Git for Windows: https://git-scm.com/downloads/win

설치 후 PowerShell을 새로 열고 실행합니다. `.cmd`를 붙이면 PowerShell의 npm/pnpm 스크립트 실행 정책 문제를 피할 수 있습니다.

```powershell
node --version
git --version
npm.cmd install --global pnpm@11.19.0
cd $HOME
git clone --branch codex/windows-research-dashboard https://github.com/spsoohojeon-hash/randomchess.git randomchess-ai
cd randomchess-ai
pnpm.cmd install --frozen-lockfile
pnpm.cmd exec wrangler login
```

브라우저에서 기존 게임을 운영하는 Cloudflare 계정으로 로그인합니다. 기존 프로젝트 폴더를 쓸 경우 미커밋 작업을 덮어쓰지 말고 위처럼 새 폴더를 사용하세요. 이 안내의 브랜치가 main에 병합된 뒤에는 `--branch codex/windows-research-dashboard`를 빼도 됩니다.

## 2. 사이트 연결과 비밀번호

`wrangler.jsonc`의 D1 ID가 본인의 기존 게임 DB인지 Cloudflare 대시보드에서 확인합니다. 기본 Worker 이름은 설정 파일의 이름과 다를 수 있으므로 실제 게임 Worker 이름을 사용합니다.

```powershell
pnpm.cmd research:setup
```

입력값:

- 사이트 주소: 기존 게임의 HTTPS 주소
- Worker 이름: 기존 주소가 `randomchess.sp-soohojeon.workers.dev`이면 `randomchess`
- 비밀번호: 원하는 비밀번호를 직접 입력합니다. 입력 문자는 화면에 표시되지 않습니다. 8자 이상이며, Enter만 누르면 기존/자동 생성 값을 유지합니다.

이 명령은 사이트 빌드·배포와 연구실 인증값 등록을 수행합니다. 성공 안내가 나오기 전에는 수집기를 시작하지 마세요. 오류가 있으면 `pnpm.cmd build`와 `pnpm.cmd exec wrangler whoami`로 확인합니다. 비밀번호나 config.json 전체를 캡처해 공유하지 마세요.

## 3. 첫 대국 확인

```powershell
pnpm.cmd research:run
```

폰에서 `https://본인-게임주소/research`를 열고 비밀번호로 로그인한 뒤 **수집 시작**을 누릅니다.

- **현황:** 누적 시작/완료/진행/확인 필요 판수, 현재 보드, 반수, 최근 대국. 5초마다 갱신.
- **능력별 승률:** 시작 능력별 완료 판수·승/무/패·승률, 상성. 0판은 `—`. 진행·중단 대국은 제외.
- **AI 학습:** 자동 학습 켜기/끄기, 수동 요청, 학습·검증·평가 판수, 반복 진행, 오차, 적용 모델.

자동 학습은 기본 100개 완료 대국마다 시도합니다. 학습 20판·검증 5판·평가 5판과 학습 표본 256개 이상이 필요합니다. 학습 중에도 별도 프로세스에서 대국을 계속합니다. 처음에는 기존 어려움 AI로 데이터를 모으고 검증을 통과한 모델이 생긴 뒤 적용됩니다. 수 제한이 없어서 한 판이 오래 지속될 수 있습니다.

## 4. 로그인 후 자동 실행

첫 대국 확인 뒤 수동 실행 창에서 **Ctrl+C**를 누르고 종료될 때까지 기다린 다음 실행합니다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\research\windows-autostart.ps1
Get-ScheduledTaskInfo -TaskName RandomChess-Research
```

현재 사용자로 작업 스케줄러에 등록하며 즉시 시작합니다. 다음에는 **Windows 로그인 후** 자동 실행됩니다. 화면 잠금은 괜찮지만 로그아웃하면 멈춥니다. 재부팅 후 로그인 전 실행을 보장하는 구성은 아닙니다. 실패 시 1분 뒤 재시도하며 중복 실행을 막습니다. 실행 시간 제한을 해제해 기본 작업 제한 때문에 며칠 뒤 종료되지 않도록 합니다.

설정 → 시스템 → 전원 및 배터리에서 **전원 연결 시 절전: 안 함**으로 설정합니다. 화면 끄기는 허용됩니다. 덮개를 닫고 쓸 노트북이라면 덮개 닫기 동작도 별도로 설정하고 통풍을 확보합니다. 배터리만 연결된 상태에서는 새 작업을 시작하지 않습니다.

자동 실행 제거 (저장 데이터는 유지):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\research\windows-autostart.ps1 -Remove
```

저장 위치는 `%USERPROFILE%\.randomchess-research`입니다. 코드 업데이트 시 이 폴더는 삭제하지 마세요. 백업은 수집기·학습기를 모두 종료한 뒤 폴더 전체를 복사합니다. 원본 대국과 모델은 GitHub에 업로드하지 않습니다.

## 확인 범위

Node 기반 게임·정보 비공개·학습 검사는 개발 환경에서 실행합니다. 실제 Windows 작업 스케줄러 실행, 사용자 Cloudflare 로그인·배포, 폰 실기기 접속은 해당 환경에서 별도로 확인해야 합니다.
