
# DeepSea 배포 및 설정 가이드 (Phase 1)

이 프로젝트는 Next.js 15, TailwindCSS, 그리고 DeepSeek API를 사용하여 구축된 개인 AI 웹 플랫폼입니다. Vercel 배포를 권장합니다.

## 1. 환경 변수 설정 (Environment Variables)

프로젝트 실행을 위해 다음 환경 변수들이 필요합니다. `.env.local` 파일(로컬 개발 시)이나 Vercel 프로젝트 설정(배포 시)에 추가해야 합니다.

| 변수 | 설명 | 예시 |
| :--- | :--- | :--- |
| `DEEPSEEK_API_KEY` | DeepSeek AI API 키 | `sk-abc12345...` |
| `APP_USERNAME` | 로그인에 사용할 아이디 | `admin` |
| `APP_PASSWORD` | 로그인에 사용할 비밀번호 | `password123!` |
| `JWT_SECRET_KEY` | JWT 서명을 위한 비밀 키 | `openssl rand -hex 32` 또는 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

> **주의:** `.env` 파일에 중요한 키를 저장하고 git에 커밋하지 마세요. `.env.local`을 사용하고 `.gitignore`에 포함되어 있는지 확인하세요.

## 2. 로컬 개발 환경 실행

1.  의존성 설치:
    ```bash
    npm install
    ```
2.  개발 서버 실행:
    ```bash
    npm run dev
    ```
3.  브라우저에서 `http://localhost:3000` 접속.

## 3. Vercel 배포 방법

이 프로젝트는 Vercel에 최적화되어 있습니다.

1.  **GitHub 리포지토리 연결**:
    - [Vercel 대시보드](https://vercel.com/dashboard)에서 'Add New Project' 클릭.
    - `deepsea` 리포지토리를 Import 합니다.

2.  **환경 변수 입력**:
    - 'Configure Project' 단계에서 **Environment Variables** 섹션을 엽니다.
    - 위 1번 항목의 환경 변수 4가지를 모두 입력합니다 (`DEEPSEEK_API_KEY`, `APP_USERNAME`, `APP_PASSWORD`, `JWT_SECRET_KEY`).

3.  **배포**:
    - 'Deploy' 버튼을 클릭합니다.
    - 배포가 완료되면 제공된 URL로 접속하여 로그인 및 채팅을 테스트합니다.

## 4. Phase 1 기능 요약

- **로그인**: 설정한 ID/PW로 로그인. JWT 쿠키가 발급되며 30일간 유지됩니다.
- **채팅 모드**:
    - **Lite**: 빠른 단답형 대화.
    - **Standard**: 시스템 프롬프트가 적용된 표준 대화. (기본값)
    - **Hardcore**: 복잡한 질문을 위한 '계획(Thinking)' -> '답변' 2단계 추론 모드.
    - **Auto**: 질문 내용에 따라 Standard/Hardcore 자동 전환.
- **저장/불러오기**: 대화 내용을 `.md` 파일로 저장하고 다시 불러올 수 있습니다. (서버 저장소 없음)

## 5. 문제 해결

- **401 Unauthorized**: 로그인이 풀렸거나 쿠키가 만료되었습니다. 다시 로그인하세요.
- **API Error**: `DEEPSEEK_API_KEY`가 올바르지 않거나 잔액이 부족할 수 있습니다. Vercel 로그를 확인하세요.
- **Thinking... 멈춤**: Hardcore 모드에서 첫 단계(계획)가 오래 걸릴 수 있습니다. Vercel의 기본 타임아웃(10초~60초)에 걸릴 수 있으므로, Pro 요금제가 아니라면 응답이 잘릴 수 있습니다. (Edge Runtime을 사용하면 완화됨)
