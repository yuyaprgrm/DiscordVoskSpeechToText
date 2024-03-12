"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoskModel = exports.SampleRate = void 0;
const vosk_1 = require("vosk");
const MODEL_PATH = "model";
exports.SampleRate = 16000;
exports.VoskModel = new vosk_1.Model(MODEL_PATH);
