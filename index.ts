import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Process from 'node:process'
import * as AGTree from '@adguard/agtree'

const TARGET_URLS = [
  'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/refs/heads/master/filters/filter_18_Annoyances_Cookies/filter.txt',
  'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/refs/heads/master/filters/filter_14_Annoyances/filter.txt',
  'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/refs/heads/master/platforms/ios/filters/18_optimized.txt',
  'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/refs/heads/master/platforms/ios/filters/14_optimized.txt',
  'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/refs/heads/master/platforms/android/filters/18_optimized.txt',
  'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/refs/heads/master/platforms/android/filters/14_optimized.txt'
]

const REMOVE_TLDS = new Set(['pl', 'ru', 'de', 'cn', 'tr', 'nl'])

const OUTPUT_DIR = Path.resolve(Process.cwd(), 'dist')

const DomainModifierNames = new Set(['denyallow', 'domain'])
const NetworkHostTerminatingChars = new Set([
  AGTree.ADBLOCK_URL_SEPARATOR, '/', AGTree.NETWORK_RULE_SEPARATOR, ':', '?', '#', '[', ']', '\\'
])

const ParserOptions: AGTree.ParserOptions = {
  ...AGTree.defaultParserOptions,
  tolerant: true,
  parseAbpSpecificRules: true,
  parseUboSpecificRules: true,
  includeRaws: true
}

function NormalizeCandidateDomain(RawDomain: string): string | null {
  let Domain = RawDomain.trim().toLowerCase()
  if (!Domain) return null

  if (Domain.startsWith(AGTree.ADBLOCK_URL_START)) Domain = Domain.slice(AGTree.ADBLOCK_URL_START.length)
  if (Domain.startsWith(AGTree.ADBLOCK_WILDCARD + '.')) Domain = Domain.slice((AGTree.ADBLOCK_WILDCARD + '.').length)
  if (Domain.endsWith(AGTree.ADBLOCK_URL_SEPARATOR)) Domain = Domain.slice(0, -1)
  if (Domain.endsWith('.')) Domain = Domain.slice(0, -1)
  
  if (Domain.startsWith('/') || Domain.includes('/') || Domain.includes('*')) return null
  if (!AGTree.DomainUtils.isValidDomainOrHostname(Domain)) return null

  return Domain
}

function IsTargetTld(RawDomain: string): boolean {
  const Domain = NormalizeCandidateDomain(RawDomain)
  if (!Domain) return false

  const Parts = Domain.split('.')
  const Tld = Parts[Parts.length - 1]
  return REMOVE_TLDS.has(Tld)
}

async function FetchWithRetry(Url: string, Retries = 3): Promise<string> {
  for (let Attempt = 1; Attempt <= Retries; Attempt++) {
    try {
      const Response = await fetch(Url)
      if (!Response.ok) throw new Error(`HTTP Error: ${Response.status}`)
      return await Response.text()
    } catch (Error) {
      if (Attempt === Retries) throw new Error(`Failed to fetch ${Url} after ${Retries} attempts. Error: ${Error}`)
      console.warn(`[Warning] Fetch failed for ${Url}. Retrying (${Attempt}/${Retries})...`)
      await new Promise(res => setTimeout(res, 2000))
    }
  }
  return ''
}

function ExtractNetworkPatternCandidates(Filter: AGTree.NetworkRule): string[] {
  const Pattern = Filter.pattern.value

  if (Pattern.startsWith(AGTree.ADBLOCK_URL_START)) {
    let Host = ''
    for (let Index = AGTree.ADBLOCK_URL_START.length; Index < Pattern.length; Index += 1) {
      if (NetworkHostTerminatingChars.has(Pattern[Index])) break
      Host += Pattern[Index]
    }
    return Host ? [Host] : []
  }

  if (Pattern.startsWith('http://') || Pattern.startsWith('https://')) {
    try {
      const ParsedUrl = new URL(Pattern)
      return [ParsedUrl.hostname]
    } catch {
      return []
    }
  }

  return []
}

function StringifyFilterList(FiltersList: AGTree.FilterList): string {
  let Output = ''
  for (let Index = 0; Index < FiltersList.children.length; Index += 1) {
    const Filter = FiltersList.children[Index]
    Output += Filter.raws?.text ?? AGTree.RuleGenerator.generate(Filter)

    if (Index !== FiltersList.children.length - 1) {
      Output += '\n'
    }
  }
  return Output
}

async function Main() {
  if (!Fs.existsSync(OUTPUT_DIR)) {
    Fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  for (let i = 0; i < TARGET_URLS.length; i++) {
    const TargetUrl = TARGET_URLS[i]
    console.log(`\n[${i + 1}/${TARGET_URLS.length}] Downloading filters from ${TargetUrl}...`)

    const UrlObj = new URL(TargetUrl)
    let FileName = UrlObj.pathname
      .split('/')
      .filter(Boolean)
      .join('_') || `filter_${i}.txt`
    
    const OutputFile = Path.resolve(OUTPUT_DIR, FileName)
    const RawText = (await FetchWithRetry(TargetUrl)).replace(/\r\n/g, '\n')
    
    console.log(`Parsing ${RawText.split('\n').length} lines of filters...`)
    const FilterList = AGTree.FilterListParser.parse(RawText, ParserOptions)
    
    const KeptRules: AGTree.AnyRule[] = []
    let DroppedCount = 0
    let MutatedCount = 0

    for (const Rule of FilterList.children) {
      if (Rule.category === AGTree.RuleCategory.Comment || Rule.category === AGTree.RuleCategory.Empty) {
        KeptRules.push(Rule)
        continue
      }

      let ShouldDrop = false
      let Mutated = false

      if (Rule.category === AGTree.RuleCategory.Network && Rule.type === AGTree.NetworkRuleType.NetworkRule) {
        const Candidates = ExtractNetworkPatternCandidates(Rule)
        if (Candidates.some(Host => IsTargetTld(Host))) {
          ShouldDrop = true
        }
      }

      if (ShouldDrop) {
        DroppedCount++
        continue
      }

      if (Rule.category === AGTree.RuleCategory.Cosmetic && Rule.domains && Rule.domains.children.length > 0) {
        const OriginalLen = Rule.domains.children.length
        Rule.domains.children = Rule.domains.children.filter(d => !IsTargetTld(d.value))
        
        if (Rule.domains.children.length === 0 && OriginalLen > 0) {
          ShouldDrop = true
        } else if (Rule.domains.children.length !== OriginalLen) {
          Mutated = true
        }
      }

      if (ShouldDrop) {
        DroppedCount++
        continue
      }

      if ('modifiers' in Rule && Rule.modifiers && Rule.modifiers.children.length > 0) {
        for (const Modifier of Rule.modifiers.children) {
          if (Modifier.value && DomainModifierNames.has(Modifier.name.value)) {
            try {
              const DomainList = AGTree.DomainListParser.parse(Modifier.value.value, ParserOptions, 0, AGTree.PIPE_MODIFIER_SEPARATOR)
              const OriginalLen = DomainList.children.length
              DomainList.children = DomainList.children.filter(d => !IsTargetTld(d.value))

              if (DomainList.children.length === 0 && OriginalLen > 0) {
                ShouldDrop = true
                break
              } else if (DomainList.children.length !== OriginalLen) {
                Modifier.value.value = DomainList.children.map(d => (d.exception ? '~' : '') + d.value).join(AGTree.PIPE_MODIFIER_SEPARATOR)
                Mutated = true
              }
            } catch {
              continue
            }
          }
        }
      }

      if (ShouldDrop) {
        DroppedCount++
        continue
      }

      if (Mutated) {
        delete Rule.raws
        MutatedCount++
      }
      
      KeptRules.push(Rule)
    }

    FilterList.children = KeptRules
    
    console.log(`Writing to ${OutputFile}...`)
    console.log(`[Result] Kept: ${KeptRules.length}, Dropped: ${DroppedCount}, Mutated: ${MutatedCount}`)
    Fs.writeFileSync(OutputFile, StringifyFilterList(FilterList), 'utf-8')
  }
  
  console.log('\nAll lists processed successfully.')
}

Main().catch(Error => {
  console.error('[Fatal Error]', Error)
  Process.exit(1)
})
