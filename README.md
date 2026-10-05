# BAY 18th — Agent AI Kill Switch

BAY 리서치 아티클 「AI Agent Wallet과 권한 위임 구조」 5장(구현: "Revoke Cash — AI agentic ver.")의 코드 저장소입니다.
Revoke.cash가 **지갑**의 approval을 점검·회수한다면, 이 프로젝트는 **지갑이 위임한 AI 에이전트**의 권한을 관리합니다.

- 대시보드: https://bay18th-killswitch.vercel.app
- 네트워크: Ethereum Sepolia (테스트넷)
- PermissionToken (소울바운드 ERC-721): [`0xA09511600787d4BF40A49CE3501af2C23d737584`](https://sepolia.etherscan.io/address/0xA09511600787d4BF40A49CE3501af2C23d737584)
- AgentWallet: [`0x0B26b3d6500E8Cf03189042b3341d5be7774d29F`](https://sepolia.etherscan.io/address/0x0B26b3d6500E8Cf03189042b3341d5be7774d29F)

## 핵심 규칙 (온체인 강제)

- 부모 → 자식 위임 트리에서 자식은 부모보다 넓은 권한을 받을 수 없습니다(attenuation).
- `freeze`는 되돌릴 수 있고 상위 체인까지 검사합니다. `revoke`는 되돌릴 수 없고 하위 토큰까지 연쇄 소각합니다.
- 발급자(부모 토큰 소유자)만 freeze/revoke할 수 있습니다. Hot Agent는 자기 토큰을 revoke할 수 없습니다.
- `AgentWallet.execute`는 `checkPolicy`를 통과해야만 실행됩니다.
- 킬스위치는 **오프체인 watcher**입니다. Hot Agent가 AgentWallet으로 보낸 실패 tx를 블록마다 감지해 Cold 키로 `revoke`를 호출합니다.

## 폴더 구조

| 폴더 | 내용 |
|---|---|
| [`contracts/`](contracts) | Foundry 프로젝트. `PermissionToken.sol`, `AgentWallet.sol`, 배포 스크립트, 테스트, `deployments.json` |
| [`agent-scripts/`](agent-scripts) | Node.js(ethers v6). `setup.js`, `mockAgentNormal.js`, `mockAgentMalicious.js`, `watcher.js`, `demoExtra.js`, `abis.js`, 실증 결과 `demo-extra-results.json` |
| [`dashboard/`](dashboard) | 정적 대시보드(`index.html`). Blockscout Sepolia API의 tx를 재생해 트리·상태·로그를 표시. 빌드 없음 |
| [`docs/`](docs) | 아티클 원고(작성 중) |

## 실행법

키는 `.env`(또는 셸 환경변수)로만 전달합니다. 예시는 [`.env.example`](.env.example)을 참고하세요.

### 컨트랙트

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts   # lib/ 는 저장소에 없음
forge build
forge test
# 배포(선택): PRIVATE_KEY 환경변수 필요
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

### 에이전트 스크립트

```bash
cd agent-scripts
npm install
npm run setup        # Cold가 root 권한 발급 → Hot Agent에게 자식 권한 위임, state.json 생성
npm run watch        # 킬스위치 watcher (COLD_PRIVATE_KEY 필요)
npm run normal       # 정상 거래(정책 통과)
npm run malicious    # 허용 목록 밖 주소로 전송 시도 → 실패 tx → watcher가 revoke
node demoExtra.js    # attenuation 거부, freeze/unfreeze, 연쇄 revoke 실증
```

`setup.js`는 `state.json`을 만들고 다른 스크립트가 읽습니다. 스크립트는 같은 폴더에서 실행해야 합니다.
Mock 에이전트는 실제 LLM이 아니라 정해진 스크립트입니다.

### 앱

연결된 지갑으로 Sepolia를 읽고, 그 지갑이 서명할 수 있는 회수를 보냅니다. 시작 블록은 PermissionToken이 배포된 블록 `11805675`입니다.

```bash
cd app
cp .env.example .env
npm install
npm test
npm run dev
```

브라우저에 나온 주소에서 Cold 지갑을 연결하고, 네트워크는 Sepolia로 둡니다. `npm run build`는 `app/dist`를 만듭니다. 그 폴더는 커밋하지 않습니다.

자동 회수(`clearErc20Allowance`)는 소스에는 있습니다. 이미 배포된 AgentWallet `0x0B26…d29F`에는 그 함수가 없습니다. 그 주소로 보낸 실패 실행은 지금 워처가 `PermissionToken.revoke`로 처리합니다. 허용량 자동 회수는 AgentWallet을 다시 배포한 뒤에만 체인에서 실행됩니다. 다시 배포하면 주소가 바뀌므로 `contracts/deployments.json`, `app/src/config.ts`의 `agentWallet`, 그리고 `AGENT_WALLET_ADDRESS`를 함께 바꿉니다.

ENSv2 역할은 Sepolia ETHRegistry `0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4`의 `EACRolesChanged`만 읽습니다. 이름마다 따로 배포된 UserRegistry는 포함하지 않습니다.

### 대시보드

`dashboard/index.html`을 브라우저로 열거나 정적 서버로 서빙하면 됩니다(서버·빌드 불필요). 배포는 `cd dashboard && npx vercel --prod`.
표시 대상은 위 두 컨트랙트뿐입니다. 임의 지갑을 조회하는 도구는 향후 과제입니다.

## 보안

- `.env`, 개인키, `state.json`은 `.gitignore`로 제외됩니다. 저장소에는 키가 없습니다.
- 개인키는 채팅·이슈·문서에 붙여 넣지 마세요. 테스트넷 전용 키만 사용하세요.
