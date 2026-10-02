import type {LocalTime} from '../core/value.ts';
import type {RawHand} from './scanner.ts';
export type Street='preflop'|'flop'|'turn'|'river';
export type Kind='ante'|'sb'|'bb'|'autoBB'|'folds'|'checks'|'calls'|'bets'|'raises'|'ALLIN'|'RETURN'|'STRADDLE'|'shows'|'mucks'|'collected'|'cashout';
export interface Diagnostic {code:string;severity:'info'|'warning'|'error';handId:string;line:number;raw:string;message:string}
export interface Token {sequence:number;line:number;raw:string;category:string}
export interface Player {name:string;seat:number;startingStack:bigint;dealtIn:boolean;cards:string[]|null}
export interface Action {sequence:number;line:number;raw:string;player:string;kind:Kind;street:Street;boardIndex:number;boardAtAction:string[];amount:bigint;to:bigint|null;fee:bigint|null;explicitAllIn:boolean}
export interface Hand {
 room:'CoinPoker';schemaVersion:number;handId:string;gameType:'NLH'|'BombPot'|'unsupported';gameRaw:string;stakesRaw:string;smallBlind:bigint;bigBlind:bigint;ante:bigint|null;
 startedAt:LocalTime|null;endedAt:LocalTime|null;tableId:string;buttonSeat:number;maxPlayers:number;players:Player[];actions:Action[];tokens:Token[];raw:RawHand;
 boards:Record<number,string[]>;runMode:string;runCount:number;summaryPresent:boolean;handRake:bigint|null;handSplashFee:bigint|null;totalPot:bigint|null;
 splashType:'none'|'regular'|'mega';splashDroppedTotal:bigint;summaryOutcomes:string[];diagnostics:Diagnostic[];
}
