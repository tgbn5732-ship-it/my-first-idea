# 📝 웹사이트 제작 및 배포 학습 요약 노트

이 노트는 회원님이 첫 번째 아이디어를 디자인하고 전 세계 인터넷에 배포(Vercel)하기까지 진행한 모든 과정과 핵심 명령어를 정리한 파일입니다. 복습이 필요할 때 언제든 VS Code에서 이 파일을 열어보세요!

---

## 1. 🎨 웹페이지 제작 및 디자인 (index.html)
* **목표**: 화면 중앙에 '내 첫번째 아이디어' 문구를 크게 띄우기
* **디자인 요소**:
  * **정렬**: `display: flex; justify-content: center; align-items: center;`를 사용해 화면 정중앙 배치.
  * **배경**: 깊은 느낌의 다크 네이비 그라데이션 적용 (`linear-gradient`).
  * **글자**: 밝은 파란색 계열의 그라데이션 및 부드러운 애니메이션 효과.
  * **카드**: 반투명 유리 질감 효과(Glassmorphism) 적용.
* **수동으로 브라우저에서 여는 법**:
  * 크롬이나 엣지 창을 열고 `index.html` 파일을 마우스로 드래그해서 브라우저 한가운데에 떨어뜨리기.

---

## 2. 💻 개발 환경 구축 (프로그램 설치)
* **nvm 및 Node.js 설치**: Node.js의 버전을 관리해 주는 도구 설치.
* **Git 설치**: 코드 버전을 기록하고 저장하는 도구 설치.
* **GitHub CLI 설치**: 명령어 창(터미널)에서 깃허브 기능을 쉽게 쓰기 위한 도구 설치.

---

## 3. 🐙 GitHub 계정 연동 및 코드 업로드
1. **사용자 정보 등록** (최초 1회 실행한 설정):
   ```powershell
   git config user.name "이성조"
   git config user.email "tgbn5732@gmail.com"
   ```
2. **GitHub 로그인 (`gh auth login`)**:
   * 터미널에 `gh auth login` 입력 후 엔터.
   * `GitHub.com` ➔ `HTTPS` ➔ `Yes` ➔ `Login with a web browser` 선택.
   * 화면에 나온 **8자리 일회용 코드**를 복사한 뒤 엔터.
   * 웹 브라우저 창(`https://github.com/login/device`)이 열리면 코드를 붙여넣고 로그인 승인.
3. **저장소 생성 및 업로드 (Push)**:
   ```powershell
   git branch -M main
   gh repo create my-first-idea --public --source=. --remote=origin --push
   ```
   * 내 깃허브 저장소 주소: [https://github.com/tgbn5732-ship-it/my-first-idea](https://github.com/tgbn5732-ship-it/my-first-idea)

---

## 4. 🚀 Vercel을 이용한 무료 웹 배포
1. [https://vercel.com](https://vercel.com) 접속.
2. **Continue with GitHub**로 회원가입 및 로그인 (보안인증 2FA는 Skip).
3. **Import Project** 클릭 ➔ 깃허브 연동 권한 허용 (`Install & Authorize`).
4. 내 깃허브 저장소 목록 중 `my-first-idea` 옆의 **`Import`** 클릭.
5. 다른 설정 건드리지 않고 **`Deploy`** 클릭 ➔ 배포 완료!
6. 내 웹사이트 고유 주소: [https://my-first-idea-opal.vercel.app](https://my-first-idea-opal.vercel.app)

---

## 🛠️ VS Code 개발 화면 구성법 (매번 컴퓨터 켤 때)
1. **VS Code 실행**: 바탕화면의 `Visual Studio Code` 아이콘 실행. (자동으로 `.antigravity` 폴더가 안 열리면 `파일 -> 폴더 열기`로 폴더 선택)
2. **제한 모드 해제**: 화면 상단에 경고창이 뜨면 `관리` 클릭 후 `예, 작성자를 신뢰합니다` 클릭.
3. **코드 열기**: 왼쪽 목록에서 `index.html` 더블 클릭.
4. **미리보기 켜기**: 코드 창 우측 상단의 **지구본(미리보기) 아이콘** 클릭 ➔ 상단 팝업에서 `index.html file:///...` 선택.
5. **화면 분할**: 상단 메뉴 `보기(V) -> 편집기 레이아웃 -> 우측 분할` 클릭 ➔ 생성된 미리보기 탭을 오른쪽 칸으로 드래그.
6. **AI 채팅창**: 오른쪽 채팅창이 안 보이면 왼쪽 세로 아이콘 바에서 `Antigravity` 아이콘 클릭.

---
👍 어제오늘 고생 많으셨습니다! 앞으로 추가 학습을 진행하시면서 필요할 때마다 이 요약 노트를 꺼내보세요!
