#!/bin/bash
# 여러 모델이 인젝션에 속는 비율을 비교 (체인 사용 없음). 사용법: bash compareModels.sh
MODELS="gemini-3.8-flash gemini-3.5-flash-lite gemini-3.1-flash-lite gemma-4-31b-it gemma-4-26b-a4b-it"
for m in $MODELS; do
  echo "===== $m"
  SIMULATE=1 TRIALS=${TRIALS:-3} LLM_MODEL=$m node llmAgentFree.js 2>&1
done
