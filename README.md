# Killswitch Dashboard — AI Agent 권한 위임 모니터

Ethereum Sepolia 테스트넷에 배포된 AI Agent 권한 위임 컨트랙트의 **실제 온체인 기록**을 보여주는 대시보드입니다. BAY 18기 아티클 「AI Agent Wallet과 권한 위임 구조」 5장(Revoke Cash — AI agentic ver.)의 구현 결과물입니다.

- PermissionToken: [`0xA09511600787d4BF40A49CE3501af2C23d737584`](https://sepolia.etherscan.io/address/0xA09511600787d4BF40A49CE3501af2C23d737584)
- AgentWallet: [`0x0B26b3d6500E8Cf03189042b3341d5be7774d29F`](https://sepolia.etherscan.io/address/0x0B26b3d6500E8Cf03189042b3341d5be7774d29F)

## 화면 구성

| 구역 | 내용 |
|---|---|
| `$ killswitch tree` | Owner → Permission(ROOT) → delegated to → Hot Agent / Sub-agent → Permission 순의 위임 트리와 각 권한 상태 (ACTIVE / FROZEN / REVOKED / EXPIRED) |
| `$ killswitch status` | 위임된 권한 수, 상태별 개수, 차단된 거래 수, 마지막 revoke, 위반 → 자동 revoke까지 걸린 시간 |
| `$ killswitch watch` | 두 컨트랙트로 들어온 모든 거래(실패한 거래 포함)를 블록 시간(KST) 순으로 표시 |

## 동작 방식

- 서버가 없는 정적 페이지 하나(`index.html`)입니다. 브라우저가 [Blockscout Sepolia API](https://eth-sepolia.blockscout.com)에서 두 컨트랙트의 거래 기록을 직접 받아옵니다. 여기에는 revert된 거래도 포함됩니다.
- 받아온 거래를 블록 순서대로 다시 재생하면서, 컨트랙트와 같은 규칙으로 권한 트리와 상태를 계산합니다. 규칙은 attenuation, freeze의 상위 전파, revoke의 연쇄 소각입니다.
- 탐색기는 revert 사유를 주지 않습니다. 그래서 실패한 거래의 사유(예: `target not in allowlist`, `attenuation: limit … > parent …`)는 그 시점의 상태로 판별해 표시합니다.
- 20초마다 자동으로 새로 불러옵니다.
- 킬스위치 워처(`agent-scripts/watcher.js`)는 온체인 밖에서 실행됩니다. 이 대시보드에는 워처가 실행한 revoke 거래가 기록으로 나타납니다.

## 로컬에서 보기

`index.html`을 브라우저로 열면 됩니다. 인터넷 연결이 필요합니다.

## GitHub Pages로 배포하기

**방법 A — 웹에서 업로드 (git 불필요)**
1. GitHub에서 새 저장소를 만듭니다. 예: `killswitch-dashboard`, **Public**.
2. 저장소 페이지에서 **Add file → Upload files**를 눌러 `index.html`, `README.md`를 올리고 Commit합니다.
3. **Settings → Pages**로 갑니다. **Source: Deploy from a branch**, **Branch: `main` / `(root)`**를 선택하고 Save합니다.
4. 1~2분 뒤 `https://<아이디>.github.io/killswitch-dashboard/` 에서 열립니다.

**방법 B — 터미널에서 git으로**
```bash
cd killswitch-dashboard
git init
git add index.html README.md
git commit -m "Add killswitch dashboard"
git branch -M main
git remote add origin https://github.com/<아이디>/killswitch-dashboard.git
git push -u origin main
```
그다음 방법 A의 3번(Settings → Pages)을 똑같이 설정합니다.

## 설정 바꾸기

컨트랙트 주소, 역할 이름, 새로고침 주기는 `index.html` 안의 `CONFIG` 객체에서 바꿀 수 있습니다.
