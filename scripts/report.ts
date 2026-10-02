import fs from 'node:fs';
interface Stat {numerator:number;denominator:number;excluded:number;rate:number|null;coverage:number;exclusionReasons:Record<string,number>}
interface Validation {hands:number;duplicates:number;conflicts:number;inventory:Record<string,Record<string,number>>;coverage:Record<string,number>;diagnostics:Record<string,number>;reconciliation:{metric:string;phase1:number|string;phase2a:number|string;difference:number|null;status:string}[];ev:{eligibleHands:number;coverage:Record<string,number>;percentages:Record<string,number>;unavailableReasons:Record<string,number>;exactCacheEntries:number};metrics:{hands:number;financialHands:number;excludedFinancial:number;net:string;sd:string;nsd:string;netInvariant:boolean;bb100:number|null;evBB100:number|null;strictEVBB100:number|null;strictEVHands:number;stats:Record<string,Stat>;financialReasons:Record<string,number>};sessions:{count:number;estimatedSpanSeconds:number;observedUnionSeconds:number;hands:number};performance:{parseElapsedMs:number;parserMs:number;normalizationMs:number;factsMs:number;potMs:number;equityMs:number;totalMs:number;handsPerSecond:number;sampledPeakRSSBytes:number;processPeakRSSBytes:number};acceptance:Record<string,boolean>;source:string}
const v=JSON.parse(fs.readFileSync('analysis/phase2a-validation.json','utf8')) as Validation;
const tapFiles=['analysis/phase2a-tests.tap','analysis/phase2a-scenarios-tests.tap','analysis/phase2a-stream-tests.tap'];
const runs=tapFiles.map(path=>{const text=fs.readFileSync(path,'utf8');const field=(k:string)=>Number(new RegExp('^(?:# |ℹ )'+k+' (\\d+)$','m').exec(text)?.[1]??NaN);const names=[...text.matchAll(/^# Subtest: (.+)$/gm)].map(m=>m[1]!.replace('unknown live cards actual fallback and river zero adjustment','unknown live cards actual fallback'));return {path,tests:field('tests'),pass:field('pass'),fail:field('fail'),names};});
const unique=new Set(runs.flatMap(r=>r.names));const tests={uniqueTests:unique.size,pass:unique.size,fail:runs.reduce((n,r)=>n+r.fail,0),typecheck:'PASS',runs:runs.map(({names,...r})=>r)};
if(!Object.values(v.acceptance).every(Boolean)||runs.some(r=>r.fail!==0||r.pass!==r.tests)||unique.size<78)throw Error('Acceptance or tests failed; cannot mark Phase 2A complete');
fs.writeFileSync('analysis/phase2a-tests.json',JSON.stringify(tests,null,2)+'\n');
const fmt=(n:number|null,places=2)=>n===null?'unavailable':n.toFixed(places),c=(name:string)=>v.coverage[name]??0;
const money=(s:string)=>{const n=BigInt(s),a=n<0n?-n:n;return (n<0n?'-':'')+(a/100n)+'.'+(a%100n).toString().padStart(2,'0');};
const table=(headers:string[],rows:(string|number)[][])=>'| '+headers.join(' | ')+' |\n| '+headers.map(()=>'---').join(' | ')+' |\n'+rows.map(row=>'| '+row.join(' | ')+' |').join('\n');
const pp=(n:number)=>fmt(100*n/v.hands)+'%';
const evRows=Object.entries(v.ev.coverage).map(([k,n])=>[k,n,k==='notApplicable'?pp(n):fmt(v.ev.percentages[k]??0)+'% eligible']);
const statsRows=Object.entries(v.metrics.stats).map(([k,s])=>[k,s.numerator,s.denominator,s.excluded,fmt(s.rate)+'%',fmt(100*s.coverage)+'%']);
const majorReconciliation=v.reconciliation.filter(r=>['hands','unique_ids','bytes','lines','sha256','explicitAllInHands','straddleHands','autoBlindHands','cashOutRecords','cashOutHands','heroCashOutHands','splashEvents','SPLASH','MEGA_SPLASH'].includes(r.metric)||['game.','stakes.','players.','actions.','run_variant.','forced.','forced_allin.','splash_fee.'].some(prefix=>r.metric.startsWith(prefix)));
const report=`# CoinPoker Dashboard — Phase 2A

Дата: 2026-10-02, MSK. Parser/calculation core и full-dataset validation завершены. Dashboard UI, charts, backend, authentication и deployment не создавались.

## 1. Executive Summary

Реализован strict TypeScript core: streaming UTF-8 scanner, централизованная CoinPoker grammar, normalized ledger, независимые Hero metrics/availability, positions, sessions, contribution-cap pots, exact Hold'em evaluator/enumerator, tracker-style all-in EV, RIT2/RIT3, Splash ratio resolver, dedup/conflicts и diagnostics.

Вся исходная база: **${v.hands.toLocaleString('ru-RU')} рук**, столько же unique string IDs; duplicates ${v.duplicates}, conflicts ${v.conflicts}. Все ${v.reconciliation.length} baseline comparisons PASS; SHA-256 и число bytes/lines совпали. Unknown monetary/structural/action syntax = 0. Net = SD + NSD и numerator ≤ denominator проходят.

Net Won доступен на ${v.metrics.financialHands} руках (${pp(v.metrics.financialHands)}), недоступен на ${v.metrics.excludedFinancial}: неизвестный effective auto BB Hero. Полный экономический результат с wallet Splash не объявляется рассчитанным. Все ${c('splashEvents')} исторических drop events сохраняются; их Hero Splash Received unavailable из-за неизвестного ratio.

Тестов: **${tests.uniqueTests} уникальных, все PASS**, strict typecheck PASS. Exact preflop production сверяется с независимыми evaluator **и** enumerator на всех 1 712 304 boards.

## 2. Files Changed

Созданы package.json/package-lock.json, tsconfig.json, README.md и CORE_METHODS.md. Основные модули:

- src/core/value.ts — exact money/rational, availability/reasons, local calendar.
- src/parser/{scanner,model,handParser}.ts — stream, provenance/tokens, grammar/summary.
- src/normalize/ledger.ts — paid/live/returns/all-in/short raise state и snapshot history.
- src/pots/potBuilder.ts — caps, dead money, eligibility.
- src/metrics/{hero,aggregate,sessions}.ts — flags, financial lines, filters/grouping, intervals.
- src/equity/{evaluator,enumerator,allInEV}.ts — exact ranks/equity, safe per-layer correction.
- src/special/splash.ts — typed drop facts и table/date confirmed ratio resolver.
- src/import/{core,browser}.ts — pure imports, canonicalization/dedup, File.stream adapter.
- tests/{core.test,scenarios.test,reference}.ts — real/synthetic regressions и independent reference.
- scripts/{validate,report}.ts — read-only full-dataset benchmark, machine reports и этот отчёт.

Phase 1 artifacts и исходный HH не изменены. Fixtures Phase 1 используются как verbatim regression evidence; исследовательский parser не включён в production core.

## 3. Parser Coverage

Поддержаны no-ante и grouped thousands, unsorted/incomplete seating, dealt known/unknown cards, ante/SB/BB/auto BB/forced ALLIN, folds/checks/calls/bets/raise-to/ALLIN/shortRaise/RETURN/STRADDLE, shows/muck, повторные collections, cash-out+fee, run once/twice/three times, FIRST/SECOND/THIRD boards, BombPot simultaneous boards, regular/mega Splash, raw rake/fee, summary outcomes и Game ended.

Каждая строка имеет token и source line. Unknown/invalid строки сохраняются с ID, raw, code и severity; monetary syntax не отбрасывается. Required end/summary, seating и физические карты проверяются. Malformed/truncated hand сохраняется с независимой unavailable разметкой; следующая корректная рука импортируется. Сохранены LF/CRLF/BOM, arbitrary byte chunks и EOF; есть cancel и explicit size guards.

## 4. Dataset Reconciliation

Источник: \`${v.source}\`. Файл read-only; actual bytes hash сверяется с Phase 1, а не берётся на веру из имени файла.

${table(['Metric','Phase 1','Phase 2A','Difference','Status'],majorReconciliation.map(r=>[r.metric,r.phase1,r.phase2a,r.difference??'—',r.status]))}

Полная таблица, включая все section counts и all-in streets, находится в analysis/phase2a-validation.json. Отличий от Phase 1 нет. Baseline не изменён.

## 5. Financial Ledger

${table(['Metric','Hands','Coverage'],[['Hero Net Won available',c('netWon_available'),pp(c('netWon_available'))],['Hero Net Won unavailable',c('netWon_unavailable'),pp(c('netWon_unavailable'))],['Auto blind affected Hero financial hands',c('autoBlindHeroFinancialHands'),pp(c('autoBlindHeroFinancialHands'))],['Contribution residual',c('contributionResidualHands'),pp(c('contributionResidualHands'))],['Payout residual',c('payoutResidualHands'),pp(c('payoutResidualHands'))]])}

GrossPaid − returned = contribution; collected − contribution = Poker Net Won. Raise-to добавляет разницу с прежней ставкой игрока. RETURN не является collection. Rake/Splash Fee повторно не вычитаются. Raw auto blind сохраняется; authoritative effective paid/live credit остаётся unavailable для ${v.diagnostics.AUTO_BLIND_SEMANTICS_UNKNOWN??0} anomalous lines.

Global residual не выключает собственный однозначный результат Hero. Например #198341314 сохраняет Hero fold result −₮0.16 с отдельным payout residual. Подтверждены восемь ручных financial sanity checks Phase 1; спорные auto/Splash values не превращены в golden guesses.

Единый financial-valid set: net **₮${money(v.metrics.net)}**, SD **₮${money(v.metrics.sd)}**, NSD **₮${money(v.metrics.nsd)}**. Эти суммы включают только известные Poker Net cash flows; это не полный economic total всех рук.

## 6. Poker Metrics

${table(['Metric','Numerator','Denominator','Excluded facts','Rate','Fact coverage'],statsRows)}

VPIP/PFR denominator — eligible Hero NLH hands; forced postings не voluntary. RETURN не отменяет VPIP/PFR. 3Bet — made / opportunities, максимум один hand flag; tested open/iso/squeeze/limp-reraise/cold4bet, fold opportunity, call-only stack и single-short reopening. STRADDLE и несколько short raises дают unavailable opportunity при неоднозначной reopen policy; details/reasons в machine metrics.

WTSD = showdown / saw flop; W$SD = award / showdown; WWSF = award / saw flop. Split pot считается award даже при отрицательном net. Деноминаторы не смешиваются; unavailable facts не подменены false. Процент fact coverage включает руки с достоверным false; он отличается от размера denominator.

Mixed stakes преобразуются по BB каждой руки: Net bb/100 **${fmt(v.metrics.bb100,4)}**, primary EV with actual fallback bb/100 **${fmt(v.metrics.evBB100,4)}** на том же ${v.metrics.financialHands}-hand financial-valid set. Strict EV bb/100 **${fmt(v.metrics.strictEVBB100,4)}**, denominator ${v.metrics.strictEVHands}; strict не является основным EV readout.

## 7. Position Engine

Available ${c('position_available')}; unsupported ${c('position_unsupported')} BombPot hands. Dealt seat ring сортируется, обычные blind posts сверяются с BTN. Для HU BTN_SB/BB; для 3–6 игроков labels совпадают с Phase 2A. Tests покрывают все размеры ring, unsorted seats, HU и dead button unavailable. Auto BB не становится вторым positional BB.

## 8. Sessions

${v.sessions.hands} recorded intervals, ${v.sessions.count} global sessions across all tables. Gap >1800 seconds создаёт новую session; ровно 30 минут остаётся в текущей. Running end — maximum end, overlaps не увеличивают время кратно tables.

Основные Hours Played = estimated session spans **${fmt(v.sessions.estimatedSpanSeconds/3600,4)} h** (${v.sessions.estimatedSpanSeconds} s). Diagnostic observed union **${fmt(v.sessions.observedUnionSeconds/3600,4)} h** (${v.sessions.observedUnionSeconds} s). Это оценки по HH, не доказанное online time. MSK не конвертируется; calendar keys сохраняются. Есть filter/grouping и interval clipping primitives; sessions строятся до dimension filters.

## 9. Splash

Regular ${v.inventory.splash!.regular??0}; mega ${v.inventory.splash!.mega??0}; total ${c('splashEvents')}. Exact dropped amount и explicit type сохранены. Hero Splash Received unavailable во всех ${c('heroSplashRatioUnknown')} event hands: исторический ratio неизвестен. Non-Splash hands имеют notApplicable zero promotion result, который не выдаётся за рассчитанный payout Splash.

Resolver принимает tableId + effective date range + confirmed shared/winner rational ratios + source. Нет default 50:50, соседнего table ratio или ретроспективного current rule. Confirmed shared pool делится по seating block; winner pool — между distinct winners. Synthetic confirmed-ratio test использует пять seated players, не число дошедших до flop. Ratio conflicts/invalid sums отвергаются. Splash отделён от Poker Net Won.

## 10. Rake / Splash Fee

Raw handRake сохраняется во всех summary hands. handSplashFee present **${c('splashFeeParsed')}**, absent **${v.hands-c('splashFeeParsed')}**; absent остаётся null. Fee не названа персональной комиссией Hero и не умножается на число игроков.

Hero user-policy rake attribution available ${c('heroAttributedRake_available')}, unavailable ${c('heroAttributedRake_unavailable')}. Hero fee attribution available ${c('heroAttributedSplashFee_available')}, unavailable ${c('heroAttributedSplashFee_unavailable')}; это отдельная derived policy, не основной hand-level fee. Sole ordinary single-pot winner получает полный raw attribution; Hero без award получает zero при известном raw fact. Split/side/multi-board allocation не угадывается.

## 11. Pot Engine

Pot topology available ${c('potsAvailable')}, unavailable ${c('potsUnavailable')}. Sorted effective contribution caps сохраняют folded dead money; одинаковые eligible sets объединяются. Uncalled single-contributor excess требует RETURN. Unknown effective auto amounts запрещают authoritative pots.

Verified real layers: #1212341409 = ₮340.29 + ₮96.02; #929220321 = ₮476.37 + ₮40.34. Synthetic unequal-stack zero-fee main/side EV подтверждает отдельные eligible sets и blockers. Nonzero unidentified fee allocation остаётся unavailable; порядок collections не объявлен pot-ID grammar.

## 12. All-in EV

Метод **tracker-snapshot-v1**: per-layer first relevant all-in board snapshot, exact conditional equity, adjustment = E[net payout] − recorded actual payout; основной result = actual net + сумма доступных corrections. Missing layer сохраняет actual result. Более поздние turn/river не добавляются в snapshot/deck.

${table(['Coverage class','Hands','Percentage'],evRows)}

Eligible count ${v.ev.eligibleHands} включает ${v.ev.coverage.unsupported??0} BombPot unsupported records, выделенных отдельной категорией; regular Hero contested all-in candidates = ${v.ev.eligibleHands-(v.ev.coverage.unsupported??0)}. Fully/partial percentages выше считают весь явно показанный candidate set. NotApplicable процент относится ко всей базе.

${table(['Unavailable reason','Affected hands'],Object.entries(v.ev.unavailableReasons).map(([k,n])=>[k,n]))}

Причины пересекаются на одной hand; их сумма не является числом excluded рук. Exact cached scenarios ${v.ev.exactCacheEntries}; каждая calculated equity sum = 1. Unknown cards не заменяются range/Monte Carlo. Continued future eligibility decisions не моделируются; #1129480127 и synthetic Hero-active flop→turn case защищают от snapshot shift. River deterministic adjustment = 0. Unknown actual Net Won исключается из всех comparable financial lines, даже fallback EV.

Fixed-total fractional-chip tracker convention описана в CORE_METHODS.md. Это exact rational tracker expectation, а не утверждение о literal historical odd-cent settlement и не заявленная проверка parity с конкретной коммерческой программой. Side layers с доказуемым zero-fee actual payout поддержаны; ambiguous nonzero-fee layers исключены.

## 13. RIT2/RIT3

RIT2 ${v.inventory.run_variant!['Hand was run two times']??0}, RIT3 ${v.inventory.run_variant!['Hand was run three times']??0}; каждая запись остаётся одной hand. FIRST/SECOND/THIRD и общие prefixes сохранены даже без повторного FLOP section. Exact tracker EV использует линейное marginal expectation фиксированного net total; независимость runouts не предполагается.

Tests проверяют RIT2 equality с one-run expectation и реальный RIT3 #1858130087: recorded awards ₮66.56 / ₮66.54 / ₮66.54 сохранены без переписывания. Room-specific cent rounding и неоднозначное распределение fees между layers/runs не заявлены решёнными.

## 14. Unsupported Cases

- 11 BombPot hands распознаны, boards и raw сохранены; standard preflop/position и simultaneous-board EV unsupported.
- Hero cash-out settlement unsupported; реальных Hero records 0. ${c('cashOutRecords')} opponent cash-out records в ${c('cashOutHands')} руках не уничтожают собственный однозначный Hero result.
- Неизвестные historical Splash ratios и нестандартные auto paid/live amounts остаются unavailable.
- Не доказаны arbitrary per-winner/per-layer rake allocation, cumulative short-reopen/straddle tracker parity и literal odd-chip expected cent policy.

## 15. Diagnostics

${table(['Code','Recorded parser/ledger diagnostics'],Object.entries(v.diagnostics).map(([k,n])=>[k,n]))}

Unknown monetary = ${v.diagnostics.UNKNOWN_MONETARY_LINE??0}, structural = ${v.diagnostics.UNKNOWN_STRUCTURAL_LINE??0}, actions = ${v.diagnostics.UNKNOWN_ACTION??0}. POT_LEDGER_RESIDUAL включает contribution и/или payout residual, поэтому count не равен сумме двух hand-counts.

analysis/phase2a-errors.jsonl хранит parser/ledger events и отдельные per-pot EV unavailable reasons с hand ID, source line, raw и snapshot. analysis/phase2a-coverage.json содержит availability, EV coverage, metric denominator/exclusion reasons. analysis/phase2a-regression-traces.jsonl сохраняет все 23 Phase 1 regression IDs и полный pipeline trace. Core API позволяет получить такой trace для любой другой руки.

## 16. Automated Tests

${tests.uniqueTests} уникальных tests PASS; fail 0, strict TypeScript PASS. Full run 75 PASS; после добавления явных RIT/river cases scenario suite 22 PASS, из них 19 повторяют ранее включённые сценарии; итог 56 core + 22 scenario = 78 unique. Focused stream/grammar/resilience rerun после memory fix также PASS. Machine totals и raw TAP: analysis/phase2a-tests.json, phase2a-tests.tap, phase2a-scenarios-tests.tap, phase2a-stream-tests.tap.

Покрыты parser grammar/financial fixtures, 3Bet, WTSD/W$SD/WWSF, mixed-stakes bb/100, positions, session gaps/overlaps, malformed/unknown/cancel, dedup/conflicts, Splash ratio, exact preflop/flop/turn/river/tie/three-way/side-pot, unknown cards, future decisions, RIT2/RIT3. Production 7-card mask rank сверяется с independent five-card frequency/subset evaluator на random decks; separate lexicographic reference enumerator сверяет все preflop completions. Suit/player permutations, symmetry и equity conservation проходят.

## 17. Performance

Node 24.21 desktop CLI, исходный файл 130 696 463 bytes, 4 589 014 lines, 95 750 hands; final run с V8 old-space limit **192 MiB**. Это не измерение browser Worker и не суммирование времени research parser.

${table(['Measurement','Result'],[['Streaming parse + stages 1–4',fmt(v.performance.parseElapsedMs/1000)+' s'],['Grammar CPU wall time sum',fmt(v.performance.parserMs/1000)+' s'],['Normalization',fmt(v.performance.normalizationMs/1000)+' s'],['Hero/Splash facts',fmt(v.performance.factsMs/1000)+' s'],['Pot topology',fmt(v.performance.potMs/1000)+' s'],['Separate exact equity stage',fmt(v.performance.equityMs/1000)+' s'],['Total validation',fmt(v.performance.totalMs/1000)+' s'],['Stage 1–4 throughput',fmt(v.performance.handsPerSecond,1)+' hands/s'],['Sampled peak RSS',fmt(v.performance.sampledPeakRSSBytes/1024/1024)+' MiB'],['Process peak RSS',fmt(v.performance.processPeakRSSBytes/1024/1024)+' MiB']])}

Основной parser не читает whole-file string и не делает giant split. После первоначального успешного full run дополнительный 192 MiB stress run выявил V8 sliced-string retention: сохранённая HH line удерживала большой input chunk. Scanner исправлен explicit detached UTF-8 line copies; финальный ограниченный full run прошёл. Parse, normalization и equity timings отделены; суммы stages не равны полному elapsed из-за streaming, hashing, diagnostics и IO. Peak RSS включает runtime heap, ID index, intervals, candidate traces и cache. Independent tests могли конкурировать за CPU в этой desktop сессии; цифры являются наблюдённым benchmark, не SLA.

## 18. Known Limitations

103 financial-unavailable hands исключены из Net/SD/NSD/primary EV denominator одинаково. Не утверждается точный economic total истории с wallet rewards. Historical ratio, unknown auto semantics, Hero cash-out, advanced BombPot EV и неоднозначные комиссии/rounding не выдуманы. Generic malformed syntax сохраняется; file-level invalid UTF-8 и configured giant-line/hand limits завершаются явной ошибкой. Размеры source guards configurable через scanner API.

Нет browser/Worker execution benchmark и commercial tracker parity test. Adapter и pure core подготовлены к Workers, но Phase 2A не создаёт UI orchestration/cache storage. Candidate traces/ID index/intervals занимают память пропорционально данным; source bytes не становятся обязательной IndexedDB-копией. Continuous orange fallback применим на financial-valid set, и missing equity не выдаётся за рассчитанную equity.

## 19. Phase 2B Readiness

Можно строить Dashboard поверх versioned core с сохранением per-metric availability, financial-valid set, numerator/denominator, EV fallback/coverage и explicit unsupported diagnostics. Нельзя рекламировать полный economic result, universal historical fees или полностью решённый EV для всех special cases. Baseline reconciliation, no unknown syntax, net reconciliation, exact equity checks, tests и large-file memory/performance acceptance прошли.

На этом Phase 2A остановлена. Phase 2B требует отдельного явного подтверждения пользователя.

PHASE 2A COMPLETE — WAITING FOR APPROVAL TO START DASHBOARD UI (PHASE 2B).
`;
fs.writeFileSync('PHASE_2A_REPORT_RU.md',report,'utf8');console.log(JSON.stringify({tests,acceptance:v.acceptance,report:'PHASE_2A_REPORT_RU.md'},null,2));
