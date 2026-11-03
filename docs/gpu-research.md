# Windows: 4판 병렬 대국 + NVIDIA GPU 학습

대국 규칙과 탐색은 CPU 작업자 4개가 서로 다른 판에서 실행합니다. GPU는 완료된 대국의 신경망 학습을 담당합니다. GPU가 체스 규칙을 직접 실행하는 구조는 아닙니다. 상대 미공개 능력과 실제 숨겨진 상태는 각 AI 작업자 및 학습 입력에서 제외합니다. 자기 능력과 관측한 공개 정보는 사용합니다.

작은 신경망이라 GPU 학습이 반드시 CPU보다 빠르지는 않습니다. 판수는 주로 CPU 탐색 속도에 달려 있습니다. 4판은 시작 설정이며 실제 처리량은 노트북에서 측정해야 합니다.

## 기존 설치 업데이트

수동 수집기 창에서 Ctrl+C로 종료합니다. 자동 실행을 등록했다면 PowerShell에서 `Stop-ScheduledTask -TaskName RandomChess-Research`도 실행합니다. 업데이트 중 원본 데이터 폴더는 삭제하지 않습니다.

```powershell
cd $HOME\randomchess-ai
git pull --ff-only
```

이 안내는 `codex/windows-research-dashboard` 브랜치를 사용합니다. `git branch --show-current`로 확인할 수 있습니다.

Python 3.12 Windows 64비트와 Python Launcher를 설치합니다: https://www.python.org/downloads/windows/

새 PowerShell을 열어 실행합니다. CUDA 포함 PyTorch 패키지를 사용하며 별도 CUDA Toolkit 설치는 필요하지 않습니다. NVIDIA 드라이버는 GPU를 지원하는 버전이어야 합니다.

```powershell
cd $HOME\randomchess-ai
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install torch==2.9.1 --index-url https://download.pytorch.org/whl/cu128
node scripts/research/configure-gpu.mjs
```

마지막 명령은 GPU에서 실제 행렬 계산과 역전파를 실행합니다. 성공할 때만 GPU 학습과 4판 병렬을 저장합니다. 실패하면 기존 설정을 유지합니다. 에러가 나면 이어서 실행하지 말고 Python 설치와 NVIDIA 드라이버를 확인하세요. PyTorch 공식 설치 명령: https://pytorch.org/get-started/previous-versions/

폰 화면도 업데이트합니다. 기존 주소·Worker 이름은 기본값을 확인하고 Enter, 비밀번호는 Enter로 기존 값을 유지합니다.

```powershell
pnpm.cmd research:setup
pnpm.cmd research:run
```

자동 실행 작업을 이미 등록했다면 `research:run` 대신 `Start-ScheduledTask -TaskName RandomChess-Research`를 사용합니다. 둘을 동시에 실행하지 마세요.

폰에서 기존 사이트의 `/research`에 로그인하고 **수집 시작**, **AI 학습 → 자동 학습 켜기**를 선택합니다. 기존 대국·모델·비밀번호는 유지됩니다. 자동 실행은 기존 Windows 안내처럼 로그인 후 동작하며 절전 중에는 계산하지 않습니다.

## 화면과 학습

- CPU 작업자 수와 최근 실행 중인 작업자 수가 표시됩니다. 5초 갱신 화면이라 매 순간의 수치와 다를 수 있습니다.
- 학습 탭에서 CUDA 백엔드, 학습에 사용한 GPU, 반복 진행과 검증 결과를 확인합니다. 첫 GPU 학습 전에는 이전 실행 상태가 표시될 수 있습니다.
- 기본 100개 완료 대국마다 학습을 시도합니다. 학습 20판·검증 5판·평가 5판 및 학습 표본 256개가 필요합니다.
- GPU 학습 결과도 기존 검증 기준을 통과해야 적용됩니다. 실패하면 기존 모델을 유지하고 실패 상태를 보고합니다. CUDA 실패를 CPU 실행으로 숨기지 않습니다.
- 자동대국은 양쪽 합계 600행동에서 제한 무승부로 종료하며 무승부 라벨로 학습합니다. 규칙 오류로 막힌 게임은 학습에 넣지 않습니다.

CPU 학습으로 직접 되돌리려면 수집기를 종료한 뒤 `node scripts/research/configure-gpu.mjs --cpu`를 실행하고 재시작합니다. 4판 병렬 설정은 유지됩니다.

## 검증 범위

개발 환경에서 실제 Node 작업자 4개의 병렬 실행, 비공개 관측 경계, 기록 재개, 신경망 학습·승격과 인증 검사를 실행했습니다. Python 문법 검사를 통과했습니다. 개발 환경에는 CUDA GPU와 PyTorch가 없어 GPU 학습 전체와 Windows 실기기 실행은 아직 검증하지 못했습니다. 설치 후 CUDA 확인과 첫 학습 완료를 확인해야 합니다.
