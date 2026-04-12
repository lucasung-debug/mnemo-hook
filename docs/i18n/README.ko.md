# mnemo-hook

**Claude Code를 위한 영속 메모리 레이어** — AI가 지난 세션에서 무슨 일이 있었는지 기억합니다.

> *mnemo* (그리스어: mneme, 기억) — 모든 세션이 이전 세션이 끝난 곳에서 시작되어야 하니까.

[English](../../README.md) | [Russian](README.ru.md) | [Chinese](README.zh.md)

---

## 문제

Claude Code 세션을 새로 시작할 때마다 맥락이 사라집니다. 무엇을 작업 중이었는지, 어떤 결정을 내렸는지, 아직 남은 것은 무엇인지 다시 설명해야 합니다. **mnemo-hook**은 Claude Code의 훅 시스템을 통해 세션 이력을 자동으로 기록하고 불러옵니다.

## 주요 기능

- **세션 브리핑** — 새 세션 시작 시 지난 세션 요약 표시: 최근 결정, 진행 상황, 미완료 항목
- **자동 저장** — git 커밋, 파일 수정 마일스톤, 핵심 결정을 자동 감지하여 저장
- **조용한 힌트** — 작업 중 과거 메모리와 관련성이 발견되면 한 줄 힌트 표시
- **심층 검색** — `recall {주제}` 입력으로 모든 저장된 메모리 검색
- **지식 그래프** — 프로젝트 그래프 + Obsidian Canvas 시각화 (선택)
- **프라이버시 우선** — 비밀번호, 토큰, 개인키 등을 자동으로 삭제 처리
- **보안 강화** — Path traversal 방지, ReDoS 방어, YAML injection 차단, GitHub/AWS/Anthropic/Slack/JWT 토큰 자동 감지

## 빠른 시작

```bash
git clone https://github.com/lucasung-debug/mnemo-hook.git
cd mnemo-hook
npm test
npm run install-hooks
# Claude Code 재시작
```

## 설정

`config/config.example.yaml`을 `~/.claude/memory/config.yaml`에 복사한 후 편집:

```yaml
obsidian_vault: /당신의/Obsidian/Vault/경로
max_hints_per_hour: 3
file_write_threshold: 3
```

### 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `MNEMO_BASE` | `~/.claude/memory` | 메모리 저장 디렉토리 |
| `MNEMO_CONFIG` | `$MNEMO_BASE/config.yaml` | 설정 파일 경로 |

## 요구사항

- Node.js >= 18
- Claude Code
- npm 의존성 없음

## 라이선스

MIT
