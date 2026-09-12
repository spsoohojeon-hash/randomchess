# 랜덤능력체스 — GitHub용 전체 소스

17종 능력, 로컬 2인, 방 코드 온라인 대전, 재접속, 재대국, 기보와 로컬 자동 저장을 포함합니다.
ChatGPT 계정이나 Sites 프로젝트 설정 없이 실행하도록 정리한 소스입니다.

**코드는 GitHub 저장소에서 관리하고, 온라인 게임은 Cloudflare Workers + D1에 배포합니다.**
이 소스를 GitHub Pages에 올리는 것만으로 게임이 실행되지는 않습니다.
이 프로젝트는 서버 렌더링과 `/api/rooms` 서버 API를 사용합니다.
[GitHub Pages는 정적 파일 호스팅 서비스입니다.](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## 1. GitHub에 올리기

ZIP을 풀고 `randomchess-github` 폴더 **안의 내용**을 저장소 최상위에 올립니다.
최상위에서 `package.json`, `README.md`, `wrangler.jsonc`, `app`, `lib`가 보여야 합니다.
ZIP 자체 대신 압축을 푼 소스를 올려 주세요.

기존 랜능체 저장소를 사용한다면 새 브랜치에서 변경사항을 확인한 뒤 반영하세요.
GitHub Desktop을 쓴다면 저장소를 로컬에 복제하고 파일을 복사한 다음 Commit → Push 하면 됩니다.
설치 후 생기는 `node_modules`, `dist`, 로컬 DB는 업로드 대상이 아닙니다.

## 2. 내 컴퓨터에서 실행

**Node.js 24 이상, pnpm 11.19.0**을 사용합니다.
필요한 pnpm 버전은 `package.json`에도 지정되어 있습니다.

```bash
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev
```

터미널에 표시되는 주소(기본 `http://localhost:5173`)에 접속합니다.
로컬 실행에는 Cloudflare 로그인이나 실제 D1 계정이 필요하지 않습니다.
DB와 방 정보는 컴퓨터의 `.wrangler/state`에 저장됩니다.

온라인 참가를 로컬에서 확인하려면 서로 다른 브라우저 프로필을 사용하세요.
첫 창에서 방을 만들고, 다른 창에서 방 코드를 입력해 참가합니다.

## 3. 인터넷에 배포하기

Cloudflare 계정에 로그인한 뒤 이 게임 전용 D1 데이터베이스를 만듭니다.

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create randomchess-db
```

출력된 `database_id`로 **`wrangler.jsonc`에 있는 임시 ID**를 교체합니다.
바인딩 이름 `DB`와 `migrations_dir`는 유지합니다.
여러 Cloudflare 계정을 사용한다면 `wrangler.jsonc`에 해당 `account_id`도 지정합니다.
`name`은 사용할 Worker 이름이며, 이미 운영 중인 다른 Worker와 구분해서 정합니다.

그다음 데이터베이스 테이블을 만들고 게임을 배포합니다.

```bash
pnpm db:migrate:remote
pnpm build
pnpm run deploy
```

성공하면 터미널에 게임 주소가 표시됩니다. 친구에게 그 주소와 방 코드를 보내면 됩니다.
클라이언트 화면과 서버 API는 같은 주소에서 제공해야 합니다.

설정을 바꾼 뒤에는 `pnpm build`를 다시 실행해야 배포 결과에 반영됩니다.
이미 적용한 SQL 파일을 수정하지 말고, DB 구조가 바뀌면 `pnpm db:generate`로 새 마이그레이션을 만듭니다.

참고: [D1 시작 안내](https://developers.cloudflare.com/d1/get-started/),
[D1 마이그레이션](https://developers.cloudflare.com/d1/reference/migrations/),
[Vinext의 Cloudflare 배포 안내](https://github.com/cloudflare/vinext#cloudflare-workers).

## 4. GitHub와 자동 배포 연결

위의 첫 배포가 완료되면 Cloudflare Workers의 Git 연결 기능으로 GitHub 저장소를 연결할 수 있습니다.
같은 Worker와 저장소를 선택하고 다음 명령을 지정합니다.

| 설정 | 값 |
| --- | --- |
| 프로젝트 루트 | `package.json`이 있는 폴더 |
| Node.js | `24` |
| 빌드 명령 | `pnpm install --frozen-lockfile && pnpm build` |
| 배포 명령 | `pnpm db:migrate:remote && pnpm run deploy` |

DB 마이그레이션을 실행하는 배포 토큰에는 해당 계정의 D1 편집 권한도 필요합니다.
로그인 토큰은 저장소에 넣지 말고 배포 서비스의 비밀 환경변수로 관리합니다.
[Cloudflare 빌드 설정](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `lib/game.ts` | 로컬과 서버가 공유하는 체스 규칙과 17종 능력 |
| `components/chess-game.tsx` | 체스판, 카드 선택, 도감, 기보, 참가·재접속 화면 |
| `app/globals.css` | 색상, 체스판과 모바일 화면 스타일 |
| `lib/room-service.ts` | 서버 판정, 참가 토큰 검증, 동시 요청 충돌 방지 |
| `app/api/rooms` | 방 생성·참가·조회·행동 API |
| `db/schema.ts`, `drizzle` | D1 테이블 정의와 SQL 마이그레이션 |
| `wrangler.jsonc` | Worker 이름과 D1 연결 설정 |
| `public/sw.js`, `public/manifest.webmanifest` | 앱 설치와 로컬 플레이 캐시 |
| `tests` | 게임 규칙과 온라인 처리 검사 |

## 게임 규칙과 데이터

일반 체스의 체크메이트 대신 **킹 포획**으로 승리합니다. 체크는 경고입니다.
기본 8종 또는 전체 17종을 고를 수 있고, 양쪽 능력은 공개됩니다.
능력을 무작위로 뽑으면 서로 다른 능력이 배정됩니다. 자세한 판정은 게임 안의 능력 도감에 있습니다.

기본 8종: 네크로맨서, 존나 야생마, 우주여행, 더블무브, 평등국가, 반동분자, 퇴마(물리), 왕의 귀환.
추가 9종: 폭탄 발사대, 그 수 하지 마, 테무산 타임스톤, 극한의 효율, 속전속결, 여왕 통치, 다재다능, 5수 앞, 양심테스트.

원본 `randomchess_v71_fix.zip` 및 이전 전체 소스의 카드 정의를 바탕으로 재구현했습니다.
야생마는 3×2 또는 2×3 점프이고, 반동분자는 킹이 잡힌 뒤 조건부로 발동합니다.
왕의 귀환의 지속 횟수는 킹 이동 시 줄어듭니다.
더블무브와 우주여행은 여왕 통치의 퀸 및 왕룩도 직접 포획할 수 없습니다.
되감기로 되감기 사용 횟수를 복구할 수 없습니다.
폭탄은 일반 이동 또는 우주여행의 첫 포획에서 발동하며, 퇴마의 범위 제거는 포획 전투로 계산하지 않습니다.

온라인 상태는 서버가 판정하고 D1에 저장하며 약 1.2초 간격으로 동기화합니다.
방은 생성 7일 후 만료됩니다. 만료된 DB 행을 자동 삭제하는 작업은 포함되어 있지 않습니다.
플레이어별 비밀 토큰은 서버에 해시로만 저장합니다.
로컬 게임과 재접속 정보는 해당 브라우저에 저장됩니다. 브라우저 데이터를 지우면 복구할 수 없습니다.
서비스 워커는 온라인 API 응답이나 참가 토큰을 캐시하지 않습니다.

## 검증

```bash
pnpm test
pnpm typecheck
pnpm build
```

기존 게임 규칙·방 처리 검사 29개를 포함합니다.
GitHub용 설정으로 29개 검사, TypeScript 확인, 배포용 빌드가 통과했습니다.
Cloudflare CLI의 로컬 DB 초기화는 작업 환경의 네트워크 제한으로 완료하지 못했습니다.
의존성은 기존 설치본을 사용했으며, 새 컴퓨터에서의 전체 재설치는 검증하지 않았습니다.
실제 휴대폰 조작, PWA 설치, 사용자 Cloudflare 계정 배포는 아직 검증하지 않았습니다.
WebMCP 현재 판 조회 도구는 지원 브라우저가 있는 경우에만 등록됩니다.

## 문제 해결

- `no such table: chess_rooms`: 로컬은 `pnpm db:migrate:local`, 배포 DB는 `pnpm db:migrate:remote`를 실행합니다.
- 배포에서 DB를 찾지 못함: `wrangler.jsonc`의 임시 ID를 실제 D1 ID로 바꾸고 다시 빌드합니다.
- `node:sqlite` 또는 `.ts` 실행 오류: Node.js 24 이상인지 `node --version`으로 확인합니다.
- pnpm 버전 오류: 위에 적은 버전을 설치하고, `pnpm-lock.yaml`을 유지한 채 다시 설치합니다.
- 압축을 풀고 HTML 파일을 직접 열어도 실행되지 않음: 위 개발 서버 또는 Workers 배포가 필요합니다.
