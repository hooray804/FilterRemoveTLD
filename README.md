# FilterRemoveTLD
Refines the adblock filter list by using [AGTree](https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/agtree/README.md
) to remove specific TLDs, keeping the filters fully optimized.

특정 국가 또는 제거 대상 TLD(Top-Level Domain)가 포함된 광고 차단 필터 규칙을 추적하여 제거하거나 변이(Mutation)시키는 자동화 빌더 도구입니다. 

AdGuard의 파서 라이브러리(`@adguard/agtree`)를 활용하여 추상 구문 트리(AST) 수준에서 안전하게 필터 규칙을 분해하고, 원하지 않는 TLD가 매칭된 규칙만 골라 도메인을 자르거나 드롭시킵니다.

## 주요 기능
* **다중 필터 목록 지원**: 복수의 원본 광고 차단 필터 URL을 동시 처리 및 다운로드할 수 있습니다.
* **네트워크 다운로드 안정성**: 외부 필터 목록 다운로드 시 네트워크 일시 오류에 대응하기 위해 재시도 메커니즘을 지원합니다.
* **AST 무결성 보존**: 주석, 빈 줄 등을 안전하게 유지하며, 매칭 도메인 삭제 후 유효하지 않게 된(도메인이 비어버린) 규칙들을 자동으로 걸러냅니다.
* **라인 엔딩 정규화**: 빌드 과정에서 발생할 수 있는 캐시 문자열과 라인 개행 혼재 문제를 방지하고 `\n`(LF) 방식으로 통일하여 저장합니다.


## 사용자 정의 설정 수정 (`index.ts`)
* `TARGET_URLS`: 가공할 원본 Adblock 필터 URL 목록을 작성합니다.
* `REMOVE_TLDS`: 필터링하여 규칙에서 제외시키고 싶은 TLD 확장자 목록을 추가합니다. (예: 대한민국 사용자의 경우 접속이 자주 일어나지 않는 `pl`, `ru`, `de` ccTLD 등)

---

## 오픈소스 라이선스 및 출처 고지 (License & Attribution)

본 프로젝트는 List-KR/List-KR 및 AdguardTeam/AdguardFilters의 일부 소스 코드를 바탕으로 수정 및 보완하여 제작되었으며, GNU General Public License v3.0 (GPL-3.0)에 따라 배포됩니다.

### 기여 및 출처 표기 (Attribution)
* **[List-KR](https://github.com/List-KR/List-KR)**: [LICENSE](https://github.com/List-KR/List-KR/blob/master/LICENSE), [Commits](https://github.com/List-KR/List-KR/commits/master/), [Contributors](https://github.com/List-KR/List-KR/graphs/contributors), [수정 사항(Commits)](https://github.com/hooray804/FilterRemoveTLD/commits/main/)
* **[AdguardFilters](https://github.com/AdguardTeam/AdguardFilters)**: [LICENSE](https://github.com/AdguardTeam/AdguardFilters/blob/master/LICENSE), [Commits](https://github.com/AdguardTeam/AdguardFilters/commits/master/), [Contributors](https://github.com/AdguardTeam/AdguardFilters/graphs/contributors), [수정 사항(Commits)](https://github.com/hooray804/FilterRemoveTLD/commits/main/)

### 라이선스 고지 (GPL-3.0)
상세한 라이선스 전문은 본 저장소의 `LICENSE` 파일에서 확인하실 수 있습니다.
