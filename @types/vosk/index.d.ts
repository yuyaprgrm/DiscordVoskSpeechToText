declare module "vosk" {
    import { Pointer } from 'ffi-napi';

    export type WordResult = {
        conf: number;
        start: number;
        end: number;
        word: string;
    }

    export type RecognitionResults = {
        result: WordResult[];
        text: string;
    }

    export type SpeakerResults = {
        spk: number[];
        spk_frames: number;
    }

    export type BaseRecognizerParam = {
        model: Model;
        sampleRate: number;
    }

    export type GrammarRecognizerParam = {
        grammar: string[];
    }

    export type SpeakerRecognizerParam = {
        speakerModel: SpeakerModel;
    }

    export type Result<T extends SpeakerRecognizerParam | GrammarRecognizerParam> = T extends SpeakerRecognizerParam ? SpeakerResults & RecognitionResults : RecognitionResults

    export type PartialResults = {
        partial: string;
    }

    export type Grammar = string[];

    export function setLogLevel(level: number): void;

    export class Model {
        public handle: Pointer<void>
        public constructor(modelPath: string);
        public free(): void;
    }

    export class SpeakerModel {
        public handle: Pointer<void>
        public constructor(modelPath: string);
        public free(): void;
    }

    export type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never }
    export type XOR<T, U> = (T | U) extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U

    export class Recognizer<T extends XOR<SpeakerRecognizerParam, Partial<GrammarRecognizerParam>>> {
        public constructor(param: T & BaseRecognizerParam);
        public free(): void;
        public setMaxAlternatives(max_alternatives: number): void;
        public setWords(words: boolean): void;
        public setPartialWords(partial_words: boolean): void;
        public setSpkModel(spk_model: SpeakerModel): void;
        public acceptWaveform(data: Buffer): boolean;
        public acceptWaveformAsync(data: Buffer): Promise<boolean>;
        public resultString(): string;
        public result(): Result<T>;
        public partialResult(): PartialResults;
        public finalResult(): Result<T>;
        public reset(): void;
    }
}